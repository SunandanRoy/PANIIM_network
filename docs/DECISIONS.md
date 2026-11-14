# Decisions and assumptions

Format: ID, decision, why, what to change if wrong. `ASSUMPTION` = unverified host fact. `ADDITION` = not in the PRD or specs.
PRD defaults D-1 to D-8 are taken as written (owner said: follow PRD BAU).

## Product defaults taken from the PRD

| ID | Decision |
|---|---|
| D-1 | Chip tier A (NTAG213/215). `chip` column also accepts `ntag424`; no signature check in v1. |
| D-2 | Unbound cards, self-activated with the printed code, plus desk binding. |
| D-3 | Contact after accept; share-on-tap opt-in, default off. |
| D-4 | Plan at N = 1,000 → `card-manifest --count 1000` produces 1,100. |
| D-5 | Edges from tap, scan and confirmed coffee only. Table, circle, office hours are logged as shared context. |
| D-6 | Default scope `presenters`. |
| D-7 | Host modules (coffee, asks, office hours, tables) are not built here. |

## Engineering decisions

| ID | Decision | Why | If wrong |
|---|---|---|---|
| E-01 ASSUMPTION | No host repo: built against `harness/` (Vite + React Router) and proven against generated Lovable-style Vite and TanStack Start templates. | Owner had no repo to give. | Run `scripts/install-into-host.mjs` against the real clone; edit `host_mapping.sql` and the adapter. |
| E-02 | Module ships its own tiny UI primitives (`components/ui.tsx`: Button, Chip, Card, Sheet, Tabs) styled only with shadcn semantic tokens (`bg-primary`, `text-muted-foreground`, `border`, `bg-card`, …) instead of importing `@/components/ui/*`. | We cannot know which shadcn components the host generated; importing a missing one breaks the build. Semantic tokens still pick up the host theme. | None needed. |
| E-03 | Wireframe accent colours (pale green, tan, lavender) are fixed module tokens in `lib/tokens.ts` via Tailwind arbitrary values. Theme colours come from `net_themes.colour`. | Host has no such tokens (ASSUMPTION). No global CSS allowed. | Swap class strings in one file. |
| E-04 | No dependency on TanStack Query, sonner, lucide or a router. Data hooks are ~60 lines; icons are inline SVG; toasts go through `adapter.toast`. | Lovable dependency audit; router-agnostic rule. | — |
| E-05 ADDITION, needs approval (CLAUDE.md rule 9) | Dependencies beyond the allowed list: **`qrcode-generator`** (MIT, zero deps, ~20 kB min) to *draw* the My pass QR. Lazy chunk. The allowed "small QR decoder" is **`jsqr`** (Apache-2.0), lazy chunk, used only when the browser lacks `BarcodeDetector`. | The pass needs a QR encoder; the allowed list only has a decoder. Writing an encoder by hand is a day of risk. | Drop the QR image and show the code + link only. |
| E-06 ADDITION | `net_meetings` (append log of every `record_meeting` call). Non-edge sources (table, circle, office_hours) become "shared context" on the profile, per PRD 6.2. | PRD says co-attendance shows as context but names no storage. | — |
| E-07 ADDITION, security | `net_record_meeting` creates an edge only if **(a)** the other person recorded the same meeting within 14 days, or **(b)** `net_host_confirms_meeting(caller, other, source)` returns true. That hook lives in `host_mapping.sql`, defaults to **false**, and the integrator points it at the host's accepted-coffee table. `net_grant_contact(viewer,'coffee')` by the owner counts as the owner's record. | Without this, any user could call `record_meeting(victim,'coffee')` and force an edge onto anyone's map. | Change the hook. |
| E-08 ADDITION | `/t/:token` also accepts the 6-character printed code (`/t/K7QX2M`). My pass QR and share link use the code URL because the raw token is never stored. The code lookup is rate-limited the same as tokens. | Raw tokens are hashed (rule 6), so the app cannot rebuild the card URL. The code is printed on the card face anyway. | — |
| E-09 ADDITION | Digital pass: a signed-in user with no active card can issue a `virtual` pass (`net_issue_digital_pass`). Activating a physical card revokes the virtual one. | Fallback for R1 (cards late) and for people who lose cards; makes My pass useful from day one. | Disable with flag `digital_pass` (default on). |
| E-10 | RPCs return `jsonb`; expected failures return `{"error":"<code>"}` instead of raising. Only a missing session raises (`net:auth`). | One error path in the client; blocked and unknown look identical. | — |
| E-11 | `net_undo_connection(other uuid)` instead of `(a, b)`: the caller is always one side. | Smaller API; same rule (initiator only, 8 s). | — |
| E-12 | Field rules for an in-scope stranger reached through **directory/detail** (not covered by the matrix) = tap-viewer fields **without** contact (share-on-tap applies to taps only). | Matrix covers tap, met, accepted, second-degree only. | — |
| E-13 | When share-on-tap is on, a tap also writes a `net_contact_grants` row (`source='share_on_tap'`), so contact stays visible after the tap like any accept. | Keeps one rule for contact visibility. | — |
| E-14 | `net_withdraw_all` **revokes** the card (not unbinds), so a lost or handed-over card cannot be re-claimed with its printed code. Consent rows are kept until retention as proof of withdrawal. | Safety. | — |
| E-15 | Activation from a tap passes the token too; the code must belong to that same card. Wrong codes: 10 per user per hour. | R10. | — |
| E-16 | Similarity: `net_refresh_similarity(user)` runs inside `net_update_profile_ext` (no triggers) plus `net_refresh_similarity_all()` for nightly / manual. | Predictable cost; no trigger surprises during bulk import. | — |
| E-17 ADDITION | RPCs not in the data contract but needed by the screens: `net_get_my_settings`, `net_update_profile_ext`, `net_list_connections`, `net_get_my_pass`, `net_issue_digital_pass`, `net_log_event` (map opens, client errors; throttled), `net_admin_export_reminders`. | Settings screen, connections list, My pass, metrics. | — |
| E-18 | Follow-up reminder (K-83) is stored as consent key `followup_reminder`; the host or organisers send the email from `net_admin_export_reminders()`. Second button label "Email me a reminder" (wireframe clipped, Q-10). | No Edge Functions, no mail service in the module. | Rename the label. |
| E-19 | Bundle-size target accepted as proposed: graph chunk ≤ 100 kB gz, module eager code < 60 kB gz. | Kickoff proposal. | — |
| E-20 | Tests run on native Postgres 16 with `supabase/tests/00_supabase_shim.sql` (roles `anon`, `authenticated`, `service_role`, `auth.uid()` from `request.jwt.claims`). Docker is not available in this build environment. | Same semantics as Supabase for RLS, grants and SECURITY DEFINER. | Run the same files with `supabase db reset` locally. |
| E-21 | Kill switch flags: `tap`, `map`, `overlap`, `galaxy`, `digital_pass`. Tap off → resolve returns `{state:'paused'}` and nothing is written. | T19. | — |
| E-22 | Rate limits: resolve (anon) 60/min per forwarded-IP hash; profile-by-token 30/min per user; connect 60/min per user; activation 10 wrong codes/hour. | K-22, K-62. | Constants at top of `030_functions_core.sql`. |
| E-23 | Module repo is `SunandanRoy/PANIIM_network` (owner confirmed 14 Nov). Gate E publishes here; no new repo is created. The Lovable host repo is not available, so E-01 (harness + generated templates) stands. | Owner's answer. | — |
| E-24 | Dependencies shipped to the host: `d3-force`, `jsqr`, `qrcode-generator`, plus dev-only `@types/d3-force`. `d3-quadtree` dropped (not imported; d3-force bundles its own). | The proof showed hosts lack d3 types. | — |
| E-25 | Dev-only tooling in this repo (never copied to the host): `pg`, `@supabase/supabase-js` (harness), `@axe-core/playwright`, Vitest, Playwright, ESLint. | Testing. | — |
| E-26 | Signed-in tap of a **revoked** card returns `revoked` ("This pass was replaced. Ask the desk.", T8), not `unknown` as data-contract section 4 says. A revoked card belongs to nobody, so it leaks nothing about blocks; a blocked card still returns exactly `{"state":"unknown"}`. | T8 and PRD 5.2 show the replaced screen. | — |
| E-27 | `net_admin_set_flag` (kill switch) requires `net_is_admin()` (host_mapping, default: `net_staff.role = 'admin'`); desk role cannot flip it. | Least privilege. | — |
| E-28 | `net_record_meeting` accepts all six sources (K-28), but tap/scan through it follow the same mutual-evidence rule as E-07. Cards use `net_connect_via_card`. | One rule. | — |
| E-29 | Tapping your own card while connected shows "met" fields plus contact if share-on-tap is on (tap path), not tap-stranger fields. | Consistency between tap and profile. | — |
