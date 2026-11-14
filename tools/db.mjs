#!/usr/bin/env node
// Local database for SQL tests. Uses PG* env vars (default postgres:postgres@localhost:5432).
//   node tools/db.mjs test   -> fresh DB, shim, install bundle twice, fixture, run supabase/tests/1*.sql..9*.sql,
//                                then uninstall and reinstall.
//   node tools/db.mjs setup  -> fresh DB for the harness: shim, install, fixture, demo seed.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = { PGHOST: "localhost", PGUSER: "postgres", PGPASSWORD: "postgres", PGPORT: "5432", ...process.env };
const mode = process.argv[2] ?? "test";
const db = mode === "setup" ? (env.NET_DB ?? "net_dev") : "net_test";

function psql(args, label) {
  const t = Date.now();
  const r = spawnSync("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", ...args], { env, encoding: "utf8" });
  const out = (r.stdout + r.stderr).split("\n").filter((l) => l && !/NOTICE: .*(skipping|does not exist)/.test(l));
  if (r.status !== 0) {
    console.error(`✗ ${label}\n${out.join("\n")}`);
    process.exit(1);
  }
  console.log(`✓ ${label} (${Date.now() - t} ms)`);
  for (const l of out) if (/PASS|RESULT|NOTICE:  (net|ok)/.test(l)) console.log("    " + l.replace(/^.*NOTICE:\s+/, ""));
}
const file = (p) => ["-d", db, "-f", join(root, p)];

psql(["-d", "postgres", "-c", `drop database if exists ${db} with (force)`, "-c", `create database ${db}`], `create database ${db}`);
psql(file("supabase/tests/00_supabase_shim.sql"), "supabase shim");
psql(file("dist/network_install.sql"), "install bundle");
psql(file("dist/network_install.sql"), "install bundle again (idempotent)");
psql(file("supabase/tests/01_fixture.sql"), "test host fixture");

if (mode === "setup") {
  psql(file("supabase/seed_demo.sql"), "demo seed");
  console.log(`database ${db} ready`);
  process.exit(0);
}

const tests = readdirSync(join(root, "supabase", "tests")).filter((f) => /^[1-9]\d_.*\.sql$/.test(f)).sort();
for (const t of tests) psql(file(`supabase/tests/${t}`), t);

psql(file("dist/network_uninstall.sql"), "uninstall");
psql(["-d", db, "-c", "do $$ begin if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'net\\_%') + (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'net\\_%') > 0 then raise exception 'net_ objects left'; end if; end $$"], "uninstall leaves no net_ objects");
psql(file("dist/network_install.sql"), "reinstall after uninstall");
console.log("SQL tests passed");
