# Installing the Network module into the Pan-IIM host app

For the person who works on the Lovable-built host app. Budget: under an hour. You never need this repo's
internals; you copy it in, make three small edits, and run one SQL file.

> **How Lovable works here.** Lovable cannot import a repository into an existing project. Its Git sync
> exports to the host's own GitHub repo, and commits on the synced branch (normally `main`) appear in Lovable.
> So you copy this module into the host repo on a feature branch, open a pull request into `main`, and merge it
> with a **merge commit** (never squash, rebase or force-push the synced branch). Lovable does **not** run SQL
> files or deploy Edge Functions when commits sync, so the database step below is always manual. The module
> uses no Edge Functions.

## 0. Prerequisites (5 min)

- Git, Node 20 or 22, and the host's package manager (npm or bun; the script detects it).
- A clone of the host repo, clean, on its synced branch: `git clone <host repo> ../paniim-host`.
- This repo cloned next to it, with `pnpm install` run once.
- Access to the host's Supabase project: the SQL editor, or Lovable chat with approval rights.
  Do **not** paste the service-role key anywhere. Nothing here needs it.
- Read `docs/HOST_RECON.md`. It lists what was assumed about the host, because the host repo was not
  available when the module was built.

## 1. Map the host's data (15 min)

Open `supabase/host_mapping.sql`. It is the **only** place that knows the host's table and column names.

1. Replace the stub `net_people` view with a `SELECT` over the host's profile, paper and session tables. Keep
   the column names and types exactly as listed. A commented example is in the file. Required:
   `user_id` (the `auth.users` id), `display_name`, `institute`, `role_label`, `role_kind`, `photo_url`, `email`,
   `phone`, `linkedin`, `paper_title`, `paper_url`, `slides_url`, `key_finding`, `session_id`, `session_title`,
   `session_start`, `room`, `is_presenter`, `is_registered`.
2. `net_is_staff()` and `net_is_admin()`: leave them as they are (desk staff are added with SQL, see
   `docs/ADMIN_RUNBOOK.md`), or point them at the host's own roles table.
3. Optional: `net_starred_sessions` and `net_has_starred_sessions()` if the host stores starred sessions.
4. Optional: `net_host_confirms_meeting()` so an accepted coffee request draws a line on the map (it returns
   `false` by default).

Then rebuild the SQL bundle: `pnpm build:sql`. This writes `dist/network_install.sql`.

## 2. Copy the module into the host (5 min)

```bash
node scripts/install-into-host.mjs --host ../paniim-host --dry-run
```

```bash
node scripts/install-into-host.mjs --host ../paniim-host
```

What the script does:

- Checks that the host is a clean tree on `main` (`--synced-branch` to change that).
- Detects React + Vite or TanStack Start.
- Creates `feat/network-module`.
- Copies `src/features/network/`, the route binding, `src/network.adapter.ts` and the SQL files.
- Adds `d3-force`, `jsqr`, `qrcode-generator` and `@types/d3-force` at pinned versions.
- Writes `NETWORK_INSTALL_REPORT.md`, then **stops before committing**.

It refuses to overwrite a file that differs unless you pass `--force`.

## 3. The three host edits (10 min)

Exact diffs are in `integration/host-edits.md`. In short:

| # | File | Change |
|---|---|---|
| 1 | The host's Network page | Import and place `MyPassButton` (top right), `VisibilityBanner` (in place of the static banner), `NetworkMapCard` (after the quick actions), `MapButton` (on the My connections row). Point the "Scan a pass" quick action at `/network/scan`. |
| 2 | Vite: `src/App.tsx` · TanStack: `src/routes/__root.tsx` | Vite: wrap `<Routes>` in `<NetworkRoot>` and put `{networkRoutes()}` inside `<Routes>` before the catch-all. TanStack: wrap `<Outlet />` in `<NetworkRoot>`. The route files are already copied. |
| 3 | `src/network.adapter.ts` (created by the script) | Check the lines marked `ADJUST`: the sign-in route and its return parameter, and the Network page path. Optionally wire `openCoffeeRequest`, `toast` (sonner) and `getLiveSession`. |

No other host file changes. Never edit `src/integrations/supabase/client.ts` or `types.ts`.

## 4. Run the SQL (5 min)

Choose one:

- **Supabase SQL editor**: paste `supabase/network/network_install.sql` (from the host) or `dist/network_install.sql`
  (from this repo) and run it. It runs as one transaction, can be run again safely, and creates only `net_*` objects.
- **Lovable chat**: paste the prompts from `LOVABLE_PROMPT.md`, one at a time, and approve.

Then add the first desk staff and import the cards. See `docs/ADMIN_RUNBOOK.md`, steps 2 and 3.

## 5. Build, verify, open the pull request (15 min)

```bash
cd ../paniim-host && npm install && npm run build
```

From this repo, run the RLS probe against the real project using the **anon key only**:

```bash
node tools/rls-probe/probe.mjs --url https://<project>.supabase.co --anon-key <anon key>
```

It must end with `RLS probe: 137/137 checks passed`.

Then check by hand:

1. Open `/t/<code of a test card>` on two phones, signed in as two people. The profile appears, the
   connection is made, and Undo works within 8 seconds.
2. Open `/network/map`. The map renders, and "Show as list" works.
3. In Lovable, open the Security view. No new warnings for `net_` tables.

Commit and push the branch, open a PR into `main`, and merge it with a merge commit. Lovable picks up the
code on merge.

## Rollback

- **Instant, no deploy**: as an organiser, open `/network/desk` → Metrics → Kill switch, and turn off taps
  and the map. Or run `update public.net_feature_flags set enabled = false where key in ('tap','map');`.
- **Front end**: revert the merge commit on `main`.
- **Database**: run `dist/network_uninstall.sql`. It removes every `net_` object and nothing else. Run
  `select public.net_retention_delete(true);` first if you want the counts.

## What this proves today

`docs/INTEGRATION_PROOF.md` is the transcript of this exact procedure on two freshly generated Lovable-style
hosts (React + Vite, and TanStack Start). Both installed, built, typechecked and passed a browser smoke test.
