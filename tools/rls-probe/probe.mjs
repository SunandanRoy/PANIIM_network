#!/usr/bin/env node
// K-63 RLS probe. Uses ONLY the public project URL and the anon (publishable) key, like an attacker would.
// Passes when every net_ table returns zero rows or an error for select/insert/update/delete, and every
// net_ RPC except net_resolve_token is refused without a session.
//
//   node tools/rls-probe/probe.mjs --url https://<project>.supabase.co --anon-key <anon key>
//
// Never pass a service-role key: the probe refuses keys whose JWT role is service_role.

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const base = (args.url ?? process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const key = args["anon-key"] ?? process.env.SUPABASE_ANON_KEY ?? "";
if (!base || !key) {
  console.error("usage: probe.mjs --url <project url> --anon-key <anon key>");
  process.exit(2);
}
try {
  const payload = JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString("utf8") || "{}");
  if (payload.role === "service_role") {
    console.error("Refusing: that is a service-role key. Use the anon/publishable key.");
    process.exit(2);
  }
} catch {
  /* not a JWT (publishable keys are opaque): fine */
}

export const TABLES = [
  "net_schema_version", "net_themes", "net_profile_ext", "net_profile_themes", "net_cards", "net_connections",
  "net_meetings", "net_contact_grants", "net_blocks", "net_reports", "net_consents", "net_person_notes",
  "net_tap_events", "net_similarity_edges", "net_feature_flags", "net_staff", "net_audit", "net_metric_events",
  "net_aggregates", "net_people", "net_starred_sessions",
];

const U = "00000000-0000-4000-8000-000000000000";
// Every net_ RPC with plausible arguments, so a refusal is a permission refusal, not a signature mismatch.
export const RPCS = {
  net_resolve_token: { p_token: "0000000000000000" },
  net_get_feature_flags: {}, net_list_themes: {},
  net_get_profile_by_token: { p_token: "0000000000000000" },
  net_connect_via_card: { p_token: "0000000000000000" },
  net_undo_connection: { p_other: U },
  net_record_meeting: { p_other: U, p_source: "coffee" },
  net_activate_card: { p_code: "AAAAAA" },
  net_report_lost_card: {}, net_get_my_pass: {}, net_issue_digital_pass: {}, net_get_my_settings: {},
  net_set_consent: { p_key: "discoverable", p_value: true },
  net_update_profile_ext: { p: {} }, net_withdraw_all: {},
  net_grant_contact: { p_viewer: U }, net_revoke_contact: { p_viewer: U },
  net_get_profile_detail: { p_user: U }, net_set_note: { p_about: U, p_body: "x" },
  net_remove_connection: { p_other: U }, net_list_connections: {}, net_block_user: { p_other: U },
  net_unblock_user: { p_other: U }, net_report_user: { p_other: U, p_reason: "spam" },
  net_log_event: { p_kind: "map_open" }, net_get_ego_graph: {}, net_get_my_network_summary: {},
  net_venn_counts: { p_theme_ids: [1] }, net_list_region: { p_theme_ids: [1], p_region: "A" },
  net_search_people: {}, net_suggest_people: {},
  net_admin_whoami: {}, net_admin_find_delegate: { p_q: "ab" }, net_admin_bind_card: { p_user: U, p_code: "AAAAAA" },
  net_admin_unbind_card: { p_card_id: U }, net_admin_revoke_card: { p_card_id: U },
  net_admin_swap_lost_card: { p_user: U, p_new_code: "AAAAAA" }, net_admin_list_cards: {},
  net_admin_import_cards: { p_rows: [] }, net_admin_list_reports: {}, net_admin_resolve_report: { p_id: U, p_resolution: "x" },
  net_admin_metrics: {}, net_admin_set_flag: { p_key: "tap", p_enabled: false }, net_admin_export_reminders: {},
  // internal: must not be callable at all
  net_retention_delete: { p_dry_run: false, p_force: true }, net_refresh_similarity_all: {}, net_prune: {},
  net_refresh_similarity: { p_user: U }, net_is_staff: {}, net_is_admin: {}, net_host_confirms_meeting: { p_caller: U, p_other: U, p_source: "coffee" },
  net__person: { p_o: U, p_level: "self" }, net__relation: { p_v: U, p_o: U },
};

const headers = { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", prefer: "return=representation" };
const results = [];
const record = (check, pass, detail) => results.push({ check, pass, detail });

async function req(method, path, body) {
  const r = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let json = null;
  try { json = await r.json(); } catch { /* empty */ }
  return { status: r.status, json };
}
const emptyOrError = (r) => r.status >= 400 || (Array.isArray(r.json) && r.json.length === 0);

for (const t of TABLES) {
  const q = `/rest/v1/${t}`;
  const sel = await req("GET", `${q}?select=*&limit=1`);
  record(`select ${t}`, emptyOrError(sel), `HTTP ${sel.status}`);
  const ins = await req("POST", q, {});
  record(`insert ${t}`, ins.status >= 400, `HTTP ${ins.status}`);
  const upd = await req("PATCH", `${q}?user_id=eq.${U}`, {});
  record(`update ${t}`, emptyOrError(upd), `HTTP ${upd.status}`);
  const del = await req("DELETE", `${q}?user_id=eq.${U}`);
  record(`delete ${t}`, emptyOrError(del), `HTTP ${del.status}`);
}

for (const [fn, body] of Object.entries(RPCS)) {
  const r = await req("POST", `/rest/v1/rpc/${fn}`, body);
  if (fn === "net_resolve_token") {
    record(`rpc ${fn} (anon allowed)`, r.status === 200 && r.json && typeof r.json.state === "string" && Object.keys(r.json).length === 1,
      `HTTP ${r.status} ${JSON.stringify(r.json)}`);
  } else {
    record(`rpc ${fn} refused`, r.status >= 400, `HTTP ${r.status} ${r.json?.code ?? ""}`);
  }
}

const failed = results.filter((r) => !r.pass);
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.check.padEnd(42)} ${r.detail}`);
console.log(`\nRLS probe: ${results.length - failed.length}/${results.length} checks passed against ${base}`);
process.exit(failed.length ? 1 : 0);
