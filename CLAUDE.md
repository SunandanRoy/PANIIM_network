# CLAUDE.md: pan-iim-network

Standing rules for this repository. Read before every session. Full detail is in `docs/`.

## What this repo is
A self-contained **feature module** (not a standalone app) that adds NFC tap cards, a connection constellation and a theme-overlap view to the Network section of the Pan-IIM WMC 2026 app (host: Lovable-built React app on Supabase). Event: 27 to 29 Nov 2026. Freeze: Wed 25 Nov 2026. Product source of truth: `docs/prd/PRD-v0.2.md`. Tickets: `docs/prd/tickets.csv`.

## Hard rules
1. **Additive only.** Never modify host files except the documented integration touch points. Never `ALTER` a host table. All database objects are prefixed `net_`.
2. **Never edit Lovable-managed files** (typically `src/integrations/supabase/client.ts`, `types.ts`, `.env`). The module receives the host's Supabase client through `NetworkHostAdapter`; it never creates its own client.
3. **Clients never touch tables.** Every `net_` table has RLS on, no client policies and no grants to `anon` or `authenticated`. Reads and writes go through `SECURITY DEFINER` RPCs with `SET search_path = ''` (fully qualified names) and explicit `GRANT EXECUTE`.
4. **Privacy order is block, then scope, then field rules**, enforced server-side only. Contact fields (email, phone, LinkedIn) never leave the server except to a user the owner has granted (or when the owner enabled share-on-tap). A blocked pair behaves like an unknown token in every response.
5. **A tap is a GET that writes nothing.** The connection is created by an authenticated RPC after render, with an 8 second undo.
6. **Raw card tokens are never stored or committed.** Store SHA-256 only. Manifest files with raw tokens go to the git-ignored `out/` folder.
7. **No Edge Functions in v1.** The host does not deploy them from synced commits. Use SQL functions.
8. **No new UI library, no global CSS.** Tailwind and shadcn/ui semantic tokens of the host. Figma and Figma Make output is a visual reference only; re-implement, do not paste.
9. **Dependencies are a cost.** Allowed without asking: `d3-force`, `d3-quadtree`, a small QR decoder (lazy chunk). Anything else needs a line in `docs/DECISIONS.md` and my approval.
10. **No secrets** in code, tests, docs, commit history or CI logs. Never print a service-role key. Use the local database for all tests.

## Stack facts to verify, not assume
The host is either React + Vite (older Lovable projects) or TanStack Start (projects created from 13 May 2026). Confirm in `docs/HOST_RECON.md` before writing router-dependent code. The module itself stays router-agnostic.

## Conventions
- TypeScript strict. Functional React components. No `any` without a comment.
- Files: `src/features/network/{screens,components,hooks,graph,lib,adapter,types}/`.
- Own types for RPC inputs and outputs in `types/rpc.ts`; do not import host `Database` types.
- Conventional Commits with ticket IDs: `feat(K-23): ...`, `fix(K-33): ...`, `test(K-63): ...`.
- Use the wireframe copy verbatim where it exists (`docs/design/wireframes/`).
- Colour is never the only cue. Tap targets at least 44 px. Respect `prefers-reduced-motion`.

## Commands (keep this section current)
- Install: `pnpm install` (Node 22, pnpm 10). Local Postgres 16 on localhost:5432 (user/password postgres) for SQL tests.
- Typecheck / lint / unit: `pnpm typecheck` (strict + Lovable-style loose pass) / `pnpm lint` / `pnpm test`
- SQL tests (local Postgres): `pnpm test:sql` (shim, install twice, RLS/grants, 96-case matrix, behaviour, perf, uninstall)
- Build SQL bundle: `pnpm build:sql` (commit `dist/`)
- Bundle-size check: `pnpm size` (graph chunk ≤ 100 kB gz, module eager < 60 kB gz, no service key)
- E2E: `pnpm e2e` (Playwright, fresh `net_e2e` database, harness API on :54322)
- RLS probe: `pnpm probe:local` (needs `pnpm db:setup` and `pnpm harness:api`); real project: see INTEGRATION.md
- Card manifest: `node tools/card-manifest/cli.mjs --count N --batch B1`
- Install into a host clone: `node scripts/install-into-host.mjs --host ../host [--dry-run]`
- Integration proof: `node scripts/prove-integration.mjs <work dir>` (writes docs/INTEGRATION_PROOF.md)

## Definition of done
Tests pass in CI and you have shown the output. Graph chunk at most 100 kB gzipped. RLS probe passes. Acceptance criterion of the ticket is tested. Status recorded in `docs/STATUS.md`.

## When to stop and ask
Host unknowns, anything needing a real Supabase project or real keys, any change to a rule above, any dependency outside the allowed list, any scope outside the PRD.
