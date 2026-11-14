# Plan

## Repo layout

As `docs/spec/integration-contract.md` section 2, plus `harness/` (no host repo, E-01).

```
src/features/network/
  index.ts                 createNetworkModule(adapter), screens, home components
  adapter/                 NetworkHostAdapter, defaultAdapter, context
  types/rpc.ts             own RPC types (no host Database types)
  lib/                     rpc wrappers, errors, retry queue, tokens, format, export (csv/vcard), venn math
  hooks/                   useRpc, useProfile, useEgoGraph, …
  components/              ui primitives, ProfileCard, Avatar, PrivacyFooter, Toast, Sheet
  screens/                 TapLanding, Activation, Profile, MyPass, Scan, Visibility, Connections, Map, Desk
  graph/                   (lazy) Constellation canvas, layout, hulls, path
supabase/
  host_mapping.sql         net_people, net_is_staff, starred sessions, host meeting hook
  migrations/              20261114000100_network_core.sql … (record + CLI)
  seed_demo.sql            demo only
  tests/                   shim, privacy matrix (96 x 6), rls, behaviour
dist/network_install.sql, dist/network_uninstall.sql
tools/ card-manifest/ rls-probe/ build-sql-bundle.mjs check-bundle-size.mjs
scripts/install-into-host.mjs
integration/ vite-react-router/ tanstack-start/ host-edits.md
harness/                   Vite + React Router dev app against local Postgres (mock RPC transport for E2E)
e2e/                       Playwright
```

## Integration touch points (three)

1. Host Network page: import `NetworkMapCard`, `MapButton`, `VisibilityBanner`, `MyPassButton`.
2. Host router: register module routes (React Router: one `<Route>` block in `App.tsx`; TanStack Start: copy route files into `src/routes/`).
3. New file `src/network.adapter.ts` from the template.

Outside app code: edit `supabase/host_mapping.sql`, run `dist/network_install.sql`, add 4 dependencies.

## Tickets to files

| Ticket | Files |
|---|---|
| K-06 themes | `migrations/*_core.sql` seed `net_themes` |
| K-12 manifest | `tools/card-manifest/` |
| K-20, K-28, K-30 schema | `migrations/*_core.sql`, `host_mapping.sql` |
| K-21, K-23, K-29 tap | `screens/TapLanding.tsx`, `net_resolve_token`, `net_get_profile_by_token` |
| K-22, K-62 RPCs, limits, kill switch | `migrations/*_functions_core.sql` |
| K-24 activation | `screens/Activation.tsx`, `net_activate_card` |
| K-25 My pass | `screens/MyPass.tsx`, `lib/qr.ts` (lazy) |
| K-26, K-83 connections, export | `screens/Connections.tsx`, `lib/export.ts` |
| K-27 lost card | `net_report_lost_card`, `net_admin_swap_lost_card` |
| K-31, K-32 profile editor, visibility | `screens/Visibility.tsx`, `screens/ProfileEditor.tsx` |
| K-33, K-34 profile detail/screen | `net_get_profile_detail`, `screens/Profile.tsx` |
| K-40–K-46, K-51 constellation | `graph/*`, `screens/MapScreen.tsx` |
| K-41 ego graph | `net_get_ego_graph` |
| K-47 home additions | `components/home/*` |
| K-50 similarity | `migrations/*_functions_graph.sql` |
| K-52, K-53 overlap | `screens/Overlap.tsx`, `net_venn_counts`, `net_list_region` |
| K-60, K-61 desk, metrics | `screens/Desk.tsx`, `net_admin_*` |
| K-63 audit | `tools/rls-probe`, `supabase/tests/*rls*`, CI gitleaks + bundle grep |
| K-64 retention | `net_retention_delete` |
| K-77 scan | `screens/Scan.tsx`, `lib/qrDecode.ts` (lazy) |
| K-81 block/report | `net_block_user`, `net_report_user`, `components/ReportBlockSheet.tsx` |
| K-54, K-55, K-79 (P2) | cut first (PRD 9.4 step 1) unless time remains; K-79 is cheap and included |

Non-software tickets (K-03, K-04, K-05, K-10, K-11, K-13–K-17, K-29 device spike, K-35 email, K-70–K-76) are listed in `docs/STATUS.md` with what the module provides for each.

## Risks specific to this build

1. No host repo: column names and stack are guesses (mitigated by the three seams).
2. No Docker / Supabase CLI here: SQL tested on native Postgres with a shim (E-20); PostgREST-level probe tested against a fake REST layer, and must be run by the integrator against the real project.
3. Real-device NFC and iOS sign-in (K-29, K-70) need humans and phones.

## Schedule to Wed 25 Nov

| Day | Work |
|---|---|
| Sat 14 | Phase 0–2: plan, tooling, SQL + tests |
| Sun 15 | Card-manifest CLI (card order due tonight); domain layer, adapter |
| Mon 16–Wed 18 | Tap, activation, pass, profile, visibility, block/report screens |
| Thu 19 | Network home components, scan sheet; G1 tap end to end on dev tags |
| Fri 20–Sun 22 | Constellation, overlap, list view, empty states |
| Mon 23 | Desk console, metrics, retention |
| Tue 24 | Integration kit, install proof, RLS probe on staging |
| Wed 25 | Freeze, RC tag |

This build session compresses the software work; the human-dependent tickets keep their PRD dates.
