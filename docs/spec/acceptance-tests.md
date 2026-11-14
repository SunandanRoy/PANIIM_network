# Acceptance tests (end to end)

Run in Playwright against the local database and the dev harness (or a host clone). Two browser contexts simulate two phones. "Tap" is simulated by opening `/t/<token>` as the second user. Real NFC hardware tests are manual (section 4).

## 1. P0 flows

| # | Scenario | Expected |
|---|---|---|
| T1 | Signed-out user opens `/t/<active token>` | Sign-in screen; after sign-in, returns to the same URL and shows the card owner |
| T2 | Signed-in B opens A's active token | Compact profile card for A; connection created after render; toast "Connected with A" with an 8 second undo bar; contact fields absent |
| T3 | B presses Undo within 8 seconds | Connection removed; no notification; page shows the not-connected state |
| T4 | B presses Undo after 8 seconds (forced via API) | Rejected |
| T5 | B opens A's token again | Connected badge, no toast, no duplicate row (`net_connections` has exactly one row for the pair) |
| T6 | A opens A's own token | No connection created; friendly message |
| T7 | Token is unbound | Activation screen; entering the correct 6-character code binds it; wrong code fails; a second active card for the same user is refused |
| T8 | Token revoked | "This pass was replaced. Ask the help desk."; no profile |
| T9 | Unknown token, and a token for a user who blocked B | Identical "We couldn't read this pass." screens and identical network responses |
| T10 | A has `share_on_tap` on with `contact_fields = [email]`, B taps | B sees email only; phone and LinkedIn absent |
| T11 | A has `share_on_tap` off, B taps, then A grants contact | Email appears for B only after the grant, on next load |
| T12 | A has scope `met`, a stranger B taps A's card | B sees A (physical tap overrides scope) |
| T13 | A has scope `met`, stranger B searches the directory | A absent from results |
| T14 | B blocks A | A disappears from B's map, overlap counts, directory; A cannot resolve B's card; any existing connection is removed |
| T15 | B reports A | Report appears in the staff queue with reason |
| T16 | Visibility sheet: change scope, toggles, contact fields | Each change appends a consent row with the text version; banner copy updates; "Withdraw all" removes the card link, connections and notes |
| T17 | Report lost card, then desk swaps a spare | Old token resolves as revoked within a second; new token works |
| T18 | Staff console: bind, unbind, revoke, CSV export; non-staff user opens it | All staff actions write `net_audit`; non-staff is denied |
| T19 | Kill switch: set `tap` flag off | `/t/:token` shows a calm "Taps are paused" message; no writes |

## 2. P1 flows

| # | Scenario | Expected |
|---|---|---|
| M1 | Map with 4 direct connections and 19 second-degree nodes | Renders and settles within 3 seconds; 30 fps or more at 150 nodes (measured in the performance test); hulls drawn per theme |
| M2 | Tap a node | Peek card fills, path to me highlighted, Open raises the profile; Esc closes and returns focus to the node |
| M3 | Theme chip filter, then clear | Non-matching nodes dim; "No one in your map matches these filters." when empty |
| M4 | List view toggle; keyboard only | Same people in closeness order; Enter opens profile; no mouse needed |
| M5 | `prefers-reduced-motion` | Static settled layout, no animation |
| M6 | Zero, one and two connections | Designed empty states; no broken graph |
| M7 | Second-degree person with `second_degree` off | Never appears as a node; their friends are not bridged through them |
| O1 | Overlap with three themes | Seven region counts add up to the number of in-scope people with at least one selected theme; list under a region matches its count |
| O2 | Select a fourth theme | Blocked with "Three themes is the maximum." |
| O3 | Switch scope My network to Event | Counts change; Event counts only `discoverable` people |
| N1 | Network home with and without connections | Map preview card, Map button, banner copy for each scope; empty map card has Scan a pass and Show my pass |
| S1 | Scan sheet: QR decode and code entry | Both resolve to the same profile as a tap |
| E1 | Export contacts | CSV and vCard contain only accepted connections |

## 3. Non-functional checks

- **Bundle:** graph chunk at most 100 kB gzipped; module total under 60 kB gzipped added to the main bundle (proposed target; script prints both numbers).
- **Latency:** `net_get_profile_by_token` p95 under 400 ms at 1,000 profiles; `net_get_ego_graph` p95 under 400 ms at 150 nodes; 500 taps per minute for 5 minutes with p95 under 800 ms and zero 5xx (k6 or autocannon against the local database).
- **Security:** `tools/rls-probe` passes; the privacy matrix (96 cases x 6 functions) passes; gitleaks finds nothing.
- **Accessibility:** axe finds no serious violations on every screen; tap targets at least 44 px.

## 4. Manual checks (humans, real devices)

At least 8 devices: iPhone XS or later, iPhone 11 to 15 (including with the camera open and in airplane mode, to confirm those cases fail gracefully), a Pixel, a Samsung, a Xiaomi, one phone with NFC off, Safari versus the installed app. Each: tap a real tag, sign in from cold, connect, undo, open map. Results go in `docs/DEVICE_MATRIX.md`.
