# Host recon

**Status: no host repository available (14 Nov 2026).** The owner chose to proceed without it. Every answer below is an
`ASSUMPTION` based on Lovable's documented project templates, not on the Pan-IIM code. Each assumption is isolated behind
one of three seams so a wrong guess costs a one-file edit:

| Seam | File | What it absorbs |
|---|---|---|
| Host data mapping | `supabase/host_mapping.sql` | Table and column names for people, sessions, presenters, staff, starred sessions, coffee confirmation |
| Host runtime | `src/network.adapter.ts` (from `integration/*/network.adapter.example.ts`) | Supabase client import path, auth hook, sign-in redirect, router, toasts, coffee/ask callbacks |
| Routes | `integration/vite-react-router/` or `integration/tanstack-start/` | Router style |

Summary in one line: **UNKNOWN stack; the module supports both React + Vite (React Router 6) and TanStack Start.**

## A. Stack

| # | Question | Answer | Evidence |
|---|---|---|---|
| 1 | Framework and router | UNKNOWN. ASSUMPTION: older Lovable template, React 18 + Vite 5 + `react-router-dom` 6, routes in `src/App.tsx`. TanStack Start binding also shipped. | Lovable docs: projects created from 13 May 2026 use TanStack Start. The live app predates the PRD; age unknown. |
| 2 | Package manager, Node | UNKNOWN. ASSUMPTION: npm or bun lockfile; Node 22. The module uses pnpm for its own repo; the install script detects the host's manager. | — |
| 3 | React / TS / Tailwind / shadcn | ASSUMPTION: React 18.3, TypeScript 5, Tailwind 3.4 with shadcn/ui HSL CSS variables (`--background`, `--primary`, …), `components.json` with alias `@/` → `src/`. The module only uses semantic classes that exist in every shadcn theme. | Lovable template |
| 4 | State / data libraries | ASSUMPTION: `@tanstack/react-query` and `sonner` present. **The module does not depend on either** (own small hooks; toasts through the adapter). | — |
| 5 | QR / canvas / d3 present | ASSUMPTION: none. Module adds `d3-force`, `d3-quadtree`, `qrcode-generator`, `jsqr`. | — |

## B. Backend

| # | Question | Answer |
|---|---|---|
| 6 | Supabase client | ASSUMPTION: `src/integrations/supabase/client.ts`, auto-generated, exports `supabase`. Adapter imports it; module never creates a client. |
| 7 | Types file | ASSUMPTION: `src/integrations/supabase/types.ts`. **Not imported**; module has its own `types/rpc.ts`. |
| 8 | Where people data lives | UNKNOWN. ASSUMPTION used in the commented example: `public.profiles(id, full_name, institute, designation, avatar_url, email, phone, linkedin_url)` plus `public.papers(presenter_id, title, abstract_url, slides_url, key_finding, session_id)` and `public.sessions(id, title, track, starts_at, room)`. Shipped `net_people` stub returns zero rows so install never fails. |
| 9 | Presenter / registered | UNKNOWN. ASSUMPTION: presenter = has a row in papers; registered = has a profile row. |
| 10 | Programme, starred sessions | UNKNOWN. `net_starred_sessions` stub (empty) and `net_has_starred_sessions()` = false, so similarity uses the renormalised weights (0.50 / 0.3125 / 0.1875). |
| 11 | Coffee / asks / office hours modules | UNKNOWN. Hooks provided: adapter callbacks, `net_record_meeting`, `net_grant_contact`, and `net_host_confirms_meeting()` in host_mapping (default false). |
| 12 | Existing RLS | UNKNOWN. The module never reads host tables from the client; `net_people` is a view owned by `postgres` and not granted to `anon`/`authenticated`. |
| 13 | Auth | ASSUMPTION: Supabase Auth (email OTP and/or Google), a sign-in page at `/auth` or `/login`; return URL param unknown. Adapter `requireAuth(returnTo)` stores the return path in `sessionStorage` as a fallback. |
| 14 | Staff identification | UNKNOWN. `net_is_staff()` defaults to membership of `net_staff`. |
| 15 | `pg_cron` | UNKNOWN (cannot be seen from a repo). Scheduling documented both ways in `docs/ADMIN_RUNBOOK.md`. |
| 16 | Edge Functions | Not used by the module. |

## C. Existing UI

| # | Question | Answer |
|---|---|---|
| 17 | Network page | UNKNOWN path. ASSUMPTION `src/pages/Network.tsx`. The integrator places `NetworkMapCard`, `MapButton`, `VisibilityBanner`, `MyPassButton` on it (host edit 1). |
| 18 | Existing profile page | UNKNOWN. Module ships its own `/network/people/:id`. |
| 19 | Layout, toasts | ASSUMPTION: shadcn `sonner`. Module calls `adapter.toast()`; default renders its own minimal live region. |
| 20 | Track colour tokens | UNKNOWN. Module owns theme colours in `net_themes.colour`. |

## D. Delivery

| # | Question | Answer |
|---|---|---|
| 21 | Default branch | ASSUMPTION `main` synced with Lovable. |
| 22 | CI / deploy | ASSUMPTION Lovable publish. |
| 23 | `/t/*` collisions, SPA fallback | UNKNOWN. Lovable hosting serves `index.html` for unknown paths (SPA). Verify by opening `/t/TEST` after install. |

## UNKNOWNs to resolve when the host repo appears

1. Stack and router (decides which binding to use).
2. Real column names for `net_people` and `net_is_staff()`.
3. Sign-in route and return-URL parameter (adapter `requireAuth`).
4. Network page file path (host edit 1).
5. Whether a coffee-request table exists (`net_host_confirms_meeting`).
6. `pg_cron` availability.

## Contradictions with `docs/spec/*`

None found; additions are listed in `docs/DECISIONS.md`.
