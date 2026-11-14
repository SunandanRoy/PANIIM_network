#!/usr/bin/env node
// DEV/TEST ONLY. A tiny PostgREST-compatible server over local Postgres, so the harness, the RLS probe and
// Playwright exercise the real SQL, grants and RLS. Never deploy this: it trusts unsigned JWTs.
//   POST   /rest/v1/rpc/<fn>                   call public.<fn>(named args) as anon or authenticated
//   GET|POST|PATCH|DELETE /rest/v1/<table>     table access as the caller's role (for the RLS probe)
//   GET    /harness/users                      demo users (for the harness sign-in picker)
//   POST   /harness/token {user_id}            unsigned dev JWT
import http from "node:http";
import pg from "pg";

const port = Number(process.env.NET_API_PORT ?? 54321);
const pool = new pg.Pool({
  host: process.env.PGHOST ?? "localhost",
  port: Number(process.env.PGPORT ?? 5432),
  user: process.env.PGUSER ?? "postgres",
  password: process.env.PGPASSWORD ?? "postgres",
  database: process.env.NET_DB ?? "net_dev",
  max: 10,
});
const ident = (s) => (typeof s === "string" && /^[a-z_][a-z0-9_]*$/.test(s) ? `"${s}"` : null);

function claimsFrom(req) {
  const m = (req.headers.authorization ?? "").match(/^Bearer\s+(.+)$/);
  if (!m) return { role: "anon" };
  const parts = m[1].split(".");
  if (parts.length !== 3) return { role: "anon" };
  try {
    const c = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return c.sub && c.role === "authenticated" ? c : { role: "anon" };
  } catch {
    return { role: "anon" };
  }
}

function send(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, prefer, accept-profile, content-profile",
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
  });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

async function asRole(req, fn) {
  const claims = claimsFrom(req);
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${claims.role === "authenticated" ? "authenticated" : "anon"}`);
    await client.query("select set_config('request.jwt.claims', $1, true), set_config('request.headers', $2, true)", [
      JSON.stringify(claims),
      JSON.stringify({ "x-forwarded-for": req.headers["x-forwarded-for"] ?? req.socket.remoteAddress }),
    ]);
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

function pgError(res, e) {
  const status = e.code === "42501" ? 403 : e.code === "42883" || e.code === "42P01" ? 404 : 400;
  send(res, status, { code: e.code ?? "PGRST", message: e.message, details: null, hint: null });
}

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

function toParam(v) {
  if (Array.isArray(v) && v.every((x) => typeof x === "number")) return v;
  return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204);
  const url = new URL(req.url, "http://x");
  try {
    if (url.pathname === "/harness/users" && req.method === "GET") {
      const r = await pool.query(
        "select p.user_id as id, p.display_name as name, p.institute, p.is_presenter, " +
          "exists (select 1 from public.net_staff s where s.user_id = p.user_id) as staff " +
          "from nettest.people p order by p.display_name",
      );
      return send(res, 200, r.rows);
    }
    if (url.pathname === "/harness/token" && req.method === "POST") {
      const { user_id } = await readBody(req);
      const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
      const token = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: user_id, role: "authenticated", exp: 4102444800 })}.dev`;
      return send(res, 200, { access_token: token });
    }
    const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z0-9_]+)$/);
    if (rpc && (req.method === "POST" || req.method === "GET")) {
      const name = ident(rpc[1]);
      const args = req.method === "POST" ? await readBody(req) : Object.fromEntries(url.searchParams);
      const keys = Object.keys(args).filter((k) => ident(k));
      const sql = `select public.${name}(${keys.map((k, i) => `${ident(k)} => $${i + 1}`).join(", ")}) as r`;
      const rows = await asRole(req, (c) => c.query(sql, keys.map((k) => toParam(args[k]))).then((r) => r.rows));
      return send(res, 200, rows[0]?.r ?? null);
    }
    const table = url.pathname.match(/^\/rest\/v1\/([a-z0-9_]+)$/);
    if (table) {
      const t = ident(table[1]);
      const out = await asRole(req, async (c) => {
        if (req.method === "GET") return (await c.query(`select * from public.${t} limit 10`)).rows;
        if (req.method === "POST") return (await c.query(`insert into public.${t} default values returning *`)).rows;
        const colRows = await c.query(
          "select a.attname from pg_attribute a where a.attrelid = to_regclass($1) and a.attnum > 0 and not a.attisdropped order by a.attnum limit 1",
          [`public.${table[1]}`],
        );
        const col = ident(colRows.rows[0]?.attname);
        if (!col) throw Object.assign(new Error(`relation public.${table[1]} does not exist`), { code: "42P01" });
        if (req.method === "PATCH") return (await c.query(`update public.${t} set ${col} = ${col} returning *`)).rows;
        if (req.method === "DELETE") return (await c.query(`delete from public.${t} returning *`)).rows;
        throw Object.assign(new Error("method not allowed"), { code: "PGRST" });
      });
      return send(res, 200, out);
    }
    send(res, 404, { message: "not found" });
  } catch (e) {
    pgError(res, e);
  }
});

server.listen(port, "127.0.0.1", () => console.log(`harness api on http://127.0.0.1:${port} (db ${pool.options.database})`));
