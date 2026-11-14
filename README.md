# pan-iim-network

The Network module for the Pan-IIM WMC 2026 app (IIM Shillong, 27 to 29 Nov 2026): NFC tap cards, a connection
constellation and a theme-overlap view, added to the Network section of the Lovable-built host app. This is a
**feature module copied into the host's repo**, not a standalone app.

- Product: `docs/prd/PRD-v0.2.md` · Specs: `docs/spec/` · Decisions: `docs/DECISIONS.md` · Status: `docs/STATUS.md`
- **Install into the host: `INTEGRATION.md`** (three host edits, one SQL file). Lovable chat prompts: `LOVABLE_PROMPT.md`
- Operations (cards, desk, kill switch, 29 Dec deletion): `docs/ADMIN_RUNBOOK.md`

## Quick start (local)

```bash
pnpm install
pnpm db:setup          # local Postgres 16: install bundle + demo data (net_dev)
pnpm harness:api &     # PostgREST-compatible dev API on :54321 (dev only)
pnpm dev               # harness on http://127.0.0.1:5173, sign in as "Demo You"
pnpm ci                # typecheck, lint, unit, SQL tests, size, secrets
pnpm e2e               # Playwright against a fresh database
```

## Layout

| Path | What |
|---|---|
| `src/features/network/` | The whole front end: copied into the host |
| `supabase/migrations/`, `supabase/host_mapping.sql` | SQL sources; `dist/network_install.sql` is the built bundle |
| `supabase/tests/` | RLS and grants, 96-case privacy matrix, behaviour, performance |
| `integration/` | Route bindings for React Router and TanStack Start, adapter templates, `host-edits.md` |
| `scripts/install-into-host.mjs` | Copies the module into a host clone, stops before committing |
| `tools/` | `card-manifest` (tokens, vendor CSV), `rls-probe`, bundle builder, size check, secret scan |
| `harness/` | Dev stand-in for the host (no host repo was available) |
