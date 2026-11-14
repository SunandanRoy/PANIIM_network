## What

<!-- One paragraph. Ticket IDs (K-xx) in the title. -->

## Checklist

- [ ] Typecheck, lint, unit tests pass (`pnpm typecheck && pnpm lint && pnpm test`)
- [ ] SQL tests pass on local Postgres (`pnpm test:sql`): RLS, 96-case privacy matrix, behaviour
- [ ] `dist/network_install.sql` rebuilt (`pnpm build:sql`) and committed
- [ ] RLS probe passes (`pnpm probe:local`)
- [ ] E2E pass (`pnpm e2e`)
- [ ] Bundle budgets hold (`pnpm size`): graph chunk ≤ 100 kB gz, module eager < 60 kB gz
- [ ] No secrets, no `.env`, no `out/` files (`pnpm secrets`)
- [ ] New `net_` tables: RLS on, zero policies, no grants; new RPCs: SECURITY DEFINER, `search_path = ''`, explicit GRANT
- [ ] Copy matches the wireframes; privacy footer on every profile state; 44 px targets; reduced motion honoured
- [ ] `docs/STATUS.md` and, if a host edit changed, `INTEGRATION.md` updated
