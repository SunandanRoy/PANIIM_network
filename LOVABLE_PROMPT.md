# Prompts for Lovable's chat

Use these when you would rather have Lovable apply the database changes than paste SQL into the Supabase
editor. Send them **one at a time**, read what Lovable shows you, and approve only what matches. Each request
is small on purpose.

Before you start, edit `supabase/host_mapping.sql` (see INTEGRATION.md step 1) and run `pnpm build:sql`, then
open `dist/network_install.sql` and copy its full contents.

---

## Prompt 1: apply the database bundle

> Please apply the SQL below to this project's Supabase database exactly as written, as one migration, after
> showing it to me for approval. Do not modify it, split it, or add anything to it. It is additive: it creates
> only tables, views and functions whose names start with `net_`, it enables row-level security on every new
> table with no policies, and it does not alter any existing table. It can be run more than once safely. After
> it has run, regenerate the Supabase types.
>
> ```sql
> <paste the full contents of dist/network_install.sql here>
> ```

Check before approving: the SQL Lovable shows begins with `-- pan-iim-network install bundle` and ends with
`commit;`, and the first table is `net_schema_version`.

---

## Prompt 2: security review of the new tables

> Please run your security check and review row-level security for every table whose name starts with `net_`.
> The intended state is: RLS enabled, zero policies, and no direct grants to `anon` or `authenticated`. All
> access goes through `SECURITY DEFINER` functions named `net_*`, each with `search_path` set to empty and an
> explicit `GRANT EXECUTE` (only `net_resolve_token` is granted to `anon`). Report any `net_` table that
> differs from this, and do not add any policies.

Expected: no warnings for `net_` tables. If Lovable proposes adding RLS policies to `net_` tables, decline. The
module is designed to have none.

---

## Prompt 3: confirm the new routes build

> The code on `main` now includes `src/features/network/` and new routes for `/t/:token`, `/network/map`,
> `/network/pass`, `/network/scan`, `/network/connections`, `/network/people/:id`,
> `/network/settings/visibility`, `/network/settings/profile` and `/network/desk`. Please confirm the project
> builds and that these routes are registered. Do not change any file under `src/features/network/`.

---

If any prompt fails, stop and use the Supabase SQL editor route in INTEGRATION.md instead.
