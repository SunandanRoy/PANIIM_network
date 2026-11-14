# Data contract (database and RPCs)

Status: specification for implementation. Derived from PRD v0.2 section 7, made more precise. **Items marked NEW are not in the PRD** and need the owner's confirmation (listed at the end). All types are Postgres.

## 0. Conventions

- Prefix `net_`, schema `public` (the only schema PostgREST exposes by default on Supabase).
- Every table: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` with **no policies** and `REVOKE ALL ON ... FROM anon, authenticated;`. Only functions below are callable.
- Functions: `LANGUAGE plpgsql` (or `sql`), `SECURITY DEFINER`, `SET search_path = ''`, fully qualified references (`public.net_cards`, `auth.uid()`), `REVOKE EXECUTE ... FROM PUBLIC; GRANT EXECUTE ... TO authenticated;` (and to `anon` only where stated).
- All functions that act for a user take the user from `auth.uid()`, never from a parameter. Return `jsonb` objects with a stable shape; return `null` (not an error) for "not visible", so that hidden, blocked and non-existent are indistinguishable.
- Install is one transaction, idempotent, versioned by `net_schema_version(version int, applied_at timestamptz)`. `uninstall.sql` removes only `net_` objects.

## 1. Host mapping (integrator edits this one file)

`supabase/host_mapping.sql` defines a view `public.net_people` over the host's own tables. Required columns:

| Column | Type | Meaning |
|---|---|---|
| user_id | uuid | `auth.users.id` |
| display_name | text | Full name |
| institute | text | Institution name |
| role_label | text | For example "Associate Professor, Operations", "PhD scholar" |
| role_kind | text | `faculty`, `phd`, `industry`, `student` (used for filters) |
| photo_url | text null | |
| email, phone, linkedin | text null | Contact fields. Never returned except under the grant rules |
| paper_title | text null | |
| paper_url, slides_url | text null | |
| key_finding | text null | One-line takeaway |
| session_id, session_title | text null | |
| session_start | timestamptz null | |
| room | text null | |
| is_presenter | boolean | Has a paper on the programme |
| is_registered | boolean | Registered delegate |

The shipped file contains a **commented example** and a stub that returns zero rows, so install never fails on an unknown host. The integrator rewrites the `SELECT` after reading `docs/HOST_RECON.md`. Nothing else in the module references host tables.

`net_is_staff() returns boolean` is also defined in this file (default: member of `net_staff`). The integrator may redefine it to use the host's admin-role mechanism.

## 2. Tables

| Table | Columns and constraints |
|---|---|
| `net_themes` | `id smallint pk`, `slug text unique`, `label text`, `colour text` (hex), `sort smallint`. 8 to 12 rows |
| `net_profile_ext` | `user_id uuid pk`, `headline text` (max 80), `bio text` (max 280), `ask_text text` (max 140), `offer_text text` (max 140), `interests text[]` (max 12 items), `ask_me_about text[]`, `open_to text[]`, `visibility_scope text check in ('presenters','all','met') default 'presenters'`, `discoverable bool default false`, `second_degree bool default false`, `share_on_tap bool default false`, `contact_fields text[] default '{email}'` (subset of email, phone, linkedin), `updated_at` |
| `net_profile_themes` | `user_id`, `theme_id`, `rank smallint check 1..3`; `pk (user_id, rank)`, `unique (user_id, theme_id)`. Rank 1 is the primary theme (node colour) |
| `net_cards` | `id uuid pk`, `token_hash bytea unique not null` (SHA-256 of the raw token), `printed_code text unique` (6 chars from an alphabet without 0, O, 1, I, L), `chip text check in ('ntag213','ntag215','ntag216','ntag424')`, `status text check in ('unbound','active','revoked') default 'unbound'`, `user_id uuid null`, `batch text`, `last_ctr int null`, `bound_at`, `bound_by uuid`, `created_at`. **Partial unique index** on `user_id where status='active'` |
| `net_connections` | `a uuid`, `b uuid`, `check (a < b)` (canonical order), `initiator uuid` (must equal a or b), `source text check in ('tap','scan','coffee','circle','office_hours','table')`, `context text null`, `card_id uuid null`, `session_id text null`, `created_at`, `removed_at null`; `pk (a, b)` |
| `net_contact_grants` NEW | `owner uuid`, `viewer uuid`, `source text` (`coffee`, `manual`, `share_on_tap`), `granted_at`, `revoked_at null`; `pk (owner, viewer)`. Records that the owner allows the viewer to see their contact fields |
| `net_blocks` | `blocker uuid`, `blocked uuid`, `created_at`; `pk (blocker, blocked)` |
| `net_reports` | `id uuid pk`, `reporter`, `reported`, `reason text check in ('spam','inappropriate','impersonation','other')`, `note text`, `status text check in ('open','resolved') default 'open'`, `resolution text null`, `resolved_by null`, `created_at` |
| `net_consents` | `id bigserial pk`, `user_id`, `key text`, `value jsonb`, `text_version text`, `at timestamptz`. **Append-only**: trigger raises on UPDATE and DELETE (except the retention function) |
| `net_person_notes` | `author uuid`, `about uuid`, `body text` (max 1000), `updated_at`; `pk (author, about)` |
| `net_tap_events` | `id bigserial`, `viewer uuid null`, `token_hash bytea`, `result text`, `at`. For rate limiting and audit. Pruned after 30 days |
| `net_similarity_edges` | `a uuid`, `b uuid`, `score real`, `computed_at`; top 8 per person; canonical order a < b |
| `net_feature_flags` | `key text pk` (`tap`, `map`, `overlap`, `galaxy`), `enabled bool` |
| `net_staff` | `user_id uuid pk`, `role text check in ('desk','admin')` |
| `net_audit` | `id bigserial`, `actor uuid`, `action text`, `subject text`, `detail jsonb`, `at` |
| `net_schema_version` | `version int`, `applied_at` |

Indexes: `net_connections (b)`, `net_connections (a) where removed_at is null`, `net_similarity_edges (a)`, `net_similarity_edges (b)`, `net_tap_events (viewer, at)`, `net_profile_themes (theme_id)`.

## 3. Relationship levels (used by every function)

For viewer V and owner O:

1. `self` if V = O.
2. `blocked` if a row exists in `net_blocks` in either direction.
3. `accepted` if an active `net_contact_grants (owner=O, viewer=V)` exists.
4. `met` if `net_connections` has an unremoved row for the pair.
5. `stranger` otherwise.

Implement as an internal function `net_relation(v uuid, o uuid) returns text`, not exposed to clients.

## 4. RPCs (client-callable)

All return `jsonb`. `-- anon` marks the only function callable without a session.

| Function | Behaviour |
|---|---|
| `net_resolve_token(token text) -- anon` | Hashes the token and returns `{state: 'unknown'|'unbound'|'revoked'|'active', code_hint?}` for signed-out viewers (no personal data). Rate limited by IP bucket where available |
| `net_get_profile_by_token(token text)` | Signed-in. Read-only. For `active` cards returns the profile via the field rules for a **tap viewer** (section 3 of `privacy-matrix.md`), plus `connection: {state}`. Blocked, revoked and unknown all return `{state:'unknown'}`. Logs a `net_tap_events` row. Rate limit: 30 per minute per user |
| `net_connect_via_card(token text)` | Idempotent. Creates the pair if absent with `source` `tap` (or `scan` if the client says so), live-session context from the adapter's `session_id` argument, `initiator = auth.uid()`. Rejects self-tap. A physical tap overrides the owner's scope but not a block. Returns `{connection_id, created}` |
| `net_undo_connection(a uuid, b uuid)` | Only the initiator, only within 8 seconds of `created_at`. Sets `removed_at`. No notification |
| `net_record_meeting(other uuid, source text, context text, session_id text)` | The single write path for every non-card source (`coffee`, `circle`, `office_hours`, `table`). Only accepts the listed sources. Which sources create an edge is controlled by `net_feature_flags.edge_sources` or a constant (default tap, scan, coffee) |
| `net_activate_card(code text, scope text)` | Binds an `unbound` card to `auth.uid()` after the printed code is matched, writes the first consent row with the chosen scope. One active card per user |
| `net_report_lost_card()` | Revokes the caller's active card immediately |
| `net_set_consent(key text, value jsonb)` | Appends a consent row and applies the setting. Keys: `visibility_scope`, `share_on_tap`, `second_degree`, `discoverable`, `contact_fields`. Takes effect on the next request |
| `net_withdraw_all()` | Removes the caller's card link, connections, notes, grants and extension row for everyone |
| `net_get_profile_detail(user_id uuid)` | Applies block, scope and field rules for the viewer's relationship. Adds `mutual` (count, or names where allowed), `path_to_me` (array, only if every hop's scope allows), `shared_sessions`, `note` (author only), `contact` (only when allowed), `connection_state`, `grant_state` |
| `net_get_ego_graph(depth int default 2, theme_ids int[] default null)` | Returns `{nodes, edges, truncated}`. Depth 1 or 2. Cap 300 nodes (nearest by similarity). Second-degree nodes only where `second_degree` is true and scope allows. Never includes blocked or out-of-scope people. p95 under 400 ms at 150 nodes |
| `net_venn_counts(theme_ids int[], scope text)` | At most 3 themes. `scope`: `network` or `event`. Returns the seven region counts plus `total`, each honouring visibility scope. Event scope counts only `discoverable` people |
| `net_list_region(theme_ids int[], region text, scope text, limit int, offset int)` | People in one region, honouring the same rules |
| `net_search_people(q text, theme_ids int[], institute text, role_kind text, session_id text, limit int)` | Directory search honouring scope and blocks |
| `net_set_note(about uuid, body text)` | Author only |
| `net_remove_connection(other uuid)` | Soft removal (`removed_at`); not notified |
| `net_block_user(other uuid)` / `net_unblock_user(other uuid)` | Block hides both ways; removes the connection and any grant |
| `net_report_user(other uuid, reason text, note text)` | Inserts a report |
| `net_grant_contact(viewer uuid, source text) NEW` | Owner allows `viewer` to see the owner's `contact_fields`. Called by the host's coffee-accept handler, or by the in-module "Share my contact" action. Also records a meeting with source `coffee` or `manual` where none exists |
| `net_revoke_contact(viewer uuid) NEW` | Owner withdraws |
| `net_get_my_network_summary()` | Counts for the Network home card: direct connections, people within two steps, pending coffee badge is supplied by the host |
| `net_get_feature_flags()` | `{tap, map, overlap, galaxy}` booleans |
| `net_list_themes()` | Themes with colours |
| **Staff (require `net_is_staff()`)** | `net_admin_find_delegate(q)`, `net_admin_bind_card(user_id, code)`, `net_admin_unbind_card(card_id)`, `net_admin_revoke_card(card_id)`, `net_admin_swap_lost_card(user_id, new_code)`, `net_admin_list_cards(status, batch)`, `net_admin_import_cards(rows jsonb)` (token hash, printed code, chip, batch), `net_admin_list_reports(status)`, `net_admin_resolve_report(id, resolution)`, `net_admin_metrics()`, `net_admin_set_flag(key, enabled)`. Each writes `net_audit` |
| **Jobs (not client-callable)** | `net_refresh_similarity(user uuid)` called by a trigger on profile and theme changes and a nightly sweep; `net_prune()` removes tap events older than 30 days; `net_retention_delete(dry_run bool default true)` deletes all module data for the 29 Dec 2026 retention, returns counts |

## 5. Similarity (K-50)

`S = 0.40 * J(themes) + 0.25 * cos(interest tags) + 0.20 * J(starred sessions) + 0.15 * min(1, mutual / 5)`

- J is the Jaccard index; cos is cosine similarity of binary interest vectors.
- "Starred sessions" come from the host. If the host has no such table, set that term to 0 and renormalise the other three weights (0.50, 0.3125, 0.1875) and say so in `docs/DECISIONS.md`.
- Keep the top 8 edges per person. Unit-test the weights sum to 1.0 and that S is in [0, 1].

## 6. Retention

Delete all `net_` data on Tue 29 Dec 2026 (29 Nov plus 30 days): connections, notes, tap events, similarity edges, consents, grants. Keep only aggregate counts without identifiers. `net_retention_delete(dry_run := true)` returns row counts first. Host profile data is not touched.

## 7. Items needing the owner's confirmation

1. NEW: `net_contact_grants`, `net_grant_contact`, `net_revoke_contact`. The PRD says contact appears "after accept" but has no storage for an acceptance.
2. A physical tap or scan of an active card overrides the owner's visibility scope (but never a block). Assumption: handing over the card is consent to be seen by that person.
3. Which sources create an edge (PRD decision D-5). Default: tap, scan and accepted coffee.
4. How `net_is_staff()` should identify desk staff in the host.
5. Whether the host has a "starred sessions" table (affects similarity weights).
