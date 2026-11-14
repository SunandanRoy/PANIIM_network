# Status

Every ticket in `docs/prd/tickets.csv`. 'Not software' means outside this repo (ops, vendor, design, PM); what the repo provides for it is noted.

Summary: Cut 1, Done 40, Not software 13, Not started 1, Partial 4, Pending 1.

| ID | Pri | Title | Status | Evidence / reason |
|---|---|---|---|---|
| K-01 | P0 | Recon of Pan-IIM app, PlanOS site and Cinemetrica reference | Done (pre-existing) | PRD section 2. |
| K-02 | P0 | Draft PRD v0.1 | Done (pre-existing) | PRD v0.1/v0.2. |
| K-03 | P0 | Confirm stack, repo access, staging and deploy path with the PlanOS team | Partial | Host repo not available; stack unknown. Module supports both stacks (proved on generated hosts). **Needs the PlanOS team.** |
| K-04 | P0 | Decide chip tier (A: NTAG21x static, B: NTAG 424 DNA) from vendor quotes and lead times | Not software | Default tier A (NTAG213) taken; `chip` accepts ntag424. Vendor quotes are a human task. |
| K-05 | P0 | Organizer sign-off on headcount, privacy defaults, retention and fiduciary wording | Not software | PRD defaults D-1..D-8 implemented as written; organiser sign-off is a human task. |
| K-06 | P0 | Seed theme taxonomy (domains) from the paper tracks and wireframe themes | Done | 10 themes seeded in `net_themes` (core migration). Mapping of every paper track is to confirm with organisers. |
| K-10 | P0 | Card artwork: logo, QR, printed 6-char code, tap-here mark; vendor spec sheet | Not software | Artwork is a design task. Card face needs: QR of `vendor.csv` url, printed code, tap mark. |
| K-12 | P0 | Token generator, card manifest CSV and pre-bound pass list (80-bit tokens, printed codes, name on card) | Done | `tools/card-manifest`: unit tests (unique tokens/codes, N+10%, hash vector equals SQL), round trip import + resolve verified. |
| K-11 | P0 | Place card order with 10% spares (quantity = ceil(1.1 x N)) | Not software | `ceil(1.1 × N)` computed by the manifest CLI; ordering is a human task. |
| K-17 | P0 | Vendor production and transit to Shillong (external wait, 10 days assumed) | Not software | Vendor production. |
| K-13 | P0 | Dev test tags: write 20 blank NTAG tags with test URLs for engineers | Not software | Write 20 dev tags with URLs from a small manifest batch (`--count 18 --batch DEV`). |
| K-14 | P1 | Vendor pre-production sample: 5 encoded cards air-shipped | Not software | Vendor samples. |
| K-15 | P0 | Goods-in check: count, read-test 10% sample, quarantine failures | Not software | Procedure in ADMIN_RUNBOOK section 3. |
| K-16 | P1 | Desk kit: signage, volunteer script, spare cards, NFC-capable test phones | Not software | Desk script in ADMIN_RUNBOOK section 4. |
| K-20 | P0 | Migration and RLS: nfc_cards, connections (with source and context), blocks, tap_events, consents | Done | 19 `net_` tables, RLS on, zero policies, no grants; reversible (uninstall test). `supabase/tests/10_rls_grants.sql`, RLS probe 136/136. |
| K-21 | P0 | Route /t/:token: states (unbound, active, revoked, unknown) and sign-in with return path | Done | All tap states render distinct screens; sign-in returns to same URL. Vitest T1/T8/T9/T19, Playwright T1/T8/T9. |
| K-22 | P0 | RPCs get_profile_by_token and connect_via_card (idempotent, undo, rate limited) | Done | Idempotent connect, GET writes nothing, 30/min cap. SQL behaviour test (K-22 assertions), Playwright T2-T5. |
| K-29 | P0 | iOS spike: Safari tab vs installed PWA sign-in state, and one-tap return path | Partial | Return path implemented (requireAuth(returnTo) + sessionStorage fallback). The iOS Safari vs PWA spike needs real iPhones. |
| K-28 | P1 | Connection rules: unique pair, self-tap block, source and session tagging, record_meeting() for non-tap sources | Done | Unique pair at DB level (PK + a<b), self-tap blocked, session tagged, record_meeting accepts only six sources. SQL behaviour test. |
| K-23 | P0 | Tap result screen: compact profile card, connect with 8 s undo, already-connected state, contact on accept | Done | Compact card, connect after render, 8 s undo, connected state, contact only per accept rule. Vitest + Playwright T2/T3/T5/T10/T11. Median-latency on 4G is a device test (K-70). |
| K-24 | P0 | Card activation: self-activate after sign-in; desk bind and unbind | Done | Self-activation with code + scope (consent row, audit row), desk bind/unbind. SQL T7/T18, Playwright T7/T18. |
| K-25 | P0 | QR on digital pass and share-link fallback (same /t/:token URL) | Done | My pass: status, code, QR (lazy encoder), share link. Playwright 'My pass'. Native-camera scan of the QR is a device test. |
| K-26 | P1 | People I've met: list in Me with search, private note, remove connection | Done | My connections: search, note (author only), remove. SQL note tests; screen in harness. |
| K-27 | P1 | Lost or stolen card: revoke and reissue | Done | Self 'Lost your card?' and desk swap; old token revoked at once. SQL T17. |
| K-30 | P0 | Profile schema: headline, bio, photo, role, institute, themes (max 3), interest tags, ask and offer, visibility scope | Done | `net_profile_ext` + `net_profile_themes` (max 3), additive; host data untouched (retention test checks it). |
| K-31 | P0 | Profile editor in onboarding step 2: domain picker, interests, photo upload, contact fields | Done | Profile editor (themes ≤3, interests, ask/offer, open-to, live completion bar); `<ProfileEditor/>` embeddable in onboarding. Photo upload stays in the host profile (512 px resize is the host's). |
| K-32 | P0 | Visibility banner and settings: scope selector, share-on-tap, discoverable, versioned log, one-tap withdraw | Done | Scope selector, share-on-tap, friends-of-friends, discoverable, contact fields, append-only consent log with version, withdraw all. SQL T16, Playwright T16. |
| K-33 | P0 | Profile detail RPC applying scope, accept and block rules | Done | 96-case privacy matrix × 6 functions (`20_privacy_matrix.sql`), mutation-tested. |
| K-34 | P0 | Profile screen per wireframe plus constellation extras (mutual, path to me, shared sessions, note, report) | Done | Profile per wireframe + mutual, path to me, shared sessions, private note, report. Screenshot check against wireframe page 2. |
| K-35 | P1 | Profile-completion nudge on Home and email to registered delegates | Not started | Email and Home banner are host/PM tasks; `ProfileEditor` completion bar is ready to reuse. |
| K-40 | P0 | Graph spike: d3-force on canvas with 150 synthetic nodes, measure fps | Done (desktop) | Canvas + d3-force, pre-settled. Measured in Chromium only; 30 fps on a mid-range Android is a device test. |
| K-47 | P0 | Network page: add map entry points to wireframed home, lazy-loaded graph chunk | Done | Home components; graph chunk 21.1 kB gz, lazy (`pnpm size`); wireframe order kept (host-edits.md). |
| K-41 | P0 | RPC get_ego_graph (depth 2, cap 300 nodes, scope and block rules honoured) | Done | Depth 2, cap 300, scope/block/second-degree honoured (matrix). p95 300 ms at 259 nodes, 2,000 profiles (`40_performance.sql`). |
| K-42 | P0 | Constellation v1: canvas render, zoom, pan, drag, domain colours, size by degree, edge width by similarity | Done | Zoom, pan, drag, theme colours, size by degree, edge width by similarity, labels for top-degree/selected only. |
| K-43 | P0 | Node tap opens profile panel; neighbour highlight; path-to-me; keyboard navigation | Done | Node buttons ≥44 px, Enter selects/opens, Esc closes and refocuses the node. Playwright M2. |
| K-44 | P1 | Filters: domain chips, institute, role, met-at-session, search with fly-to | Done | Theme chips, institute, role, session, search with fly-to. Re-render under 200 ms for 300 nodes not measured separately. |
| K-45 | P1 | Accessible list view, reduced-motion static layout, text alternative | Done | List view in closeness order, keyboard only; reduced motion = no live simulation, countdown text instead of animation. Playwright M4. |
| K-46 | P1 | Empty and low-connection states | Done | Designed zero state; one/two-connection notes. Playwright N1. |
| K-51 | P0 | Domain Venn layer: anchors, translucent hulls, multi-domain nodes pulled between anchors | Done | Theme anchors and translucent hulls; two-theme people pulled between anchors. |
| K-53 | P1 | RPC venn_counts(theme_ids up to 3, scope) honouring visibility scope | Done | Region counts sum to total; list length equals count (matrix asserts it in every case). |
| K-52 | P1 | Venn mode: pick up to 3 domains, 7-region counts, tap a region for people list | Done | Up to 3 themes, 7 regions, My network / Event, region list opens profile. Playwright O1/O2/O3. |
| K-50 | P1 | Similarity job: weighted score, top 8 edges per person, nightly plus on profile save | Done | Weighted score (weights sum to 1, renormalised without starred sessions), top 8 per person; 2,000 profiles in 23 s; per-save refresh 56 ms. |
| K-55 | P2 | Suggested connections: top 10 by score among discoverable, unconnected people | Partial (P2) | `net_suggest_people` RPC (discoverable only, behind `galaxy` flag); no screen. Cut-order step 1. |
| K-54 | P2 | Event Galaxy: all discoverable delegates as a star field with kNN links | Cut (P2) | Cut-order step 1. `galaxy` flag reserved, default off. |
| K-60 | P0 | Admin card console: batches, search delegate, bind, unbind, revoke, CSV export | Done | Desk console: search, bind, unbind, revoke, lost-card swap, batches, CSV export, import. Playwright T18. 30 s bind is a desk rehearsal. |
| K-62 | P0 | Rate limits, abuse guard and feature kill-switch on resolve and connect RPCs | Done | Rate limits (resolve 60/min/IP, profile 30/min, connect 60/min, activation 10 wrong/h); kill switch (admin only). SQL + Playwright T19. |
| K-63 | P0 | RLS and secrets audit: anon-key probe on every new table, no service key in client bundle | Done | `tools/rls-probe` 136/136 locally (mutation-tested); bundle grep finds no service key; secret scan + gitleaks in CI. **Must be re-run against the real project.** |
| K-61 | P1 | Event metrics: taps, unique connections, completion rate, graph opens, errors | Done | Metrics tile, refresh 30 s. |
| K-64 | P1 | Data export and post-event deletion job (scheduled for 29 Dec 2026) | Done | Export + `net_retention_delete` with dry run and date guard. SQL test. Staging dry run is an ops task. |
| K-70 | P0 | Device matrix: iPhone XS or later, iPhone 11 to 15, Pixel, Samsung, Xiaomi, NFC off, Safari vs PWA | Not software | Device matrix template: `docs/DEVICE_MATRIX.md`. |
| K-71 | P1 | Load test: 500 taps per minute on resolve and connect; 2,000-node graph render | Partial | SQL-level latency measured (resolve p95 0.5 ms). HTTP load test (500 taps/min) must run against staging; script not written. |
| K-74 | P1 | Delegate and volunteer onboarding: 30-second how-to-tap clip, Home banner, WhatsApp text | Not software | Clip and messages. |
| K-72 | P0 | Feature freeze and release candidate on production | Pending | RC tag after Gate E. |
| K-75 | P0 | Hypercare rota for 27 to 29 Nov, incident runbook, rollback drill | Done (docs) | Runbook section 6; drill on staging is an ops task. |
| K-73 | P0 | On-campus UAT with 20 volunteers using dev tags and sample cards; go or no-go | Not software | On-campus UAT. |
| K-76 | P2 | Retrospective, deletion verification, metrics report | Not software | Post-event. |
| K-77 | P1 | Scan sheet: in-app QR scan and 6-char code entry for phones without background NFC | Done | Camera scan (BarcodeDetector, jsQR lazy fallback) and code entry resolve to the tap screen. Playwright S1 (code entry); camera path needs a device. |
| K-81 | P0 | Block and report: RPCs, profile menu, admin review queue | Done | Block both ways, report queue. SQL T14/T15, Playwright T14/T15. |
| K-79 | P2 | Ask and offer badges on profile and node tooltip | Done (P2, cheap) | Ask/offer on profile and in node tooltip/peek. |
| K-83 | P1 | After the conference: export contacts and follow-up reminder | Done | Export CSV/vCard of accepted connections only; reminder opt-in + organiser export. Vitest + Playwright E1. |
