# Integration contract: getting this module into a Lovable project

## 1. What Lovable documents (and what that forces)

Facts below are from Lovable's documentation, read on 14 Nov 2026. Re-check them before the integrator starts, because Lovable changes quickly.

| Fact | Consequence for this repo |
|---|---|
| Git sync is two-way for one **synced branch** (default branch). Commits pushed to it appear in Lovable. Other branches do not appear until merged into the synced branch ([Git sync overview](https://docs.lovable.dev/integrations/git-sync-overview)). | Integrator opens a PR from a feature branch into the synced branch. The install script creates that branch. |
| **Importing an existing repository is not supported.** Connecting a project always creates a new repository; code can be imported only as a ZIP that makes a new project ([Git integration](https://docs.lovable.dev/integrations/git-integration), [Import a project](https://docs.lovable.dev/features/projects/import-project)). | "Merge this repo into the host" means copying files into the host's own repo on its synced branch, not linking this repo to Lovable. Do not design for a Git submodule or a Lovable-side import. |
| If Lovable and GitHub each have commits the other lacks, Lovable pushes to `lovable-sync`; force-pushes, rebases and squashes of Lovable's commits trigger a backup notice and can replace Lovable's work. | Integrate with a **merge commit**; never force-push or rebase the host branch. Say this in `INTEGRATION.md`. |
| **Synced backend files do not take effect automatically.** Lovable does not run new migration files or deploy changed Edge Functions when commits sync; you must ask Lovable to deploy or run the SQL yourself ([Git sync overview](https://docs.lovable.dev/integrations/git-sync-overview)). | Ship a single SQL bundle and a Lovable chat prompt. No Edge Functions in v1. |
| Schema changes made through Lovable's chat are shown as SQL and run only after approval; Lovable then saves a file under `supabase/migrations/` and regenerates types ([Supabase integration](https://docs.lovable.dev/integrations/supabase)). The page does not say whether SQL pushed from GitHub is applied. | The migration file in our repo is a record and for CLI users. The reliable path is: paste `dist/network_install.sql` into the Supabase SQL editor, or paste `LOVABLE_PROMPT.md` into Lovable's chat and approve. |
| Lovable runs a dependency audit and updates its Security view when synced commits change dependencies. | Keep dependencies to the allowed list and document each. |
| New projects since 13 May 2026 use **TanStack Start**; older projects use React + Vite and are not migrated automatically ([Upgrade to TanStack Start](https://docs.lovable.dev/features/upgrade-to-tanstack-start)). | Router-agnostic module, two route bindings, Phase 0 detection. |
| GitHub rejects files over 100 MB; Lovable cannot edit files over 10 MB. | Do not commit images or data dumps. Card artwork stays outside the module. |
| Lovable flags missing RLS after schema changes and says missing policies are the most common cause of exposed data. | RLS on every table, zero client policies, probe script, and a line in `LOVABLE_PROMPT.md` asking Lovable to run its security review. |

## 2. Target repository layout

```
pan-iim-network/
  README.md                  what this is, 10-line quick start
  INTEGRATION.md             step-by-step install into a Lovable repo
  LOVABLE_PROMPT.md          ready-to-paste chat prompts for Lovable
  CLAUDE.md
  src/features/network/      the whole front-end module (copied into host)
    index.ts                 public API: createNetworkModule(adapter), screens
    adapter/                 NetworkHostAdapter type + defaultAdapter
    screens/ components/ hooks/ graph/ lib/ types/
  integration/
    vite-react-router/       route snippets and an example src/network.adapter.ts
    tanstack-start/          file-route snippets and an example adapter
    host-edits.md            the exact list of host files to touch, with diffs
  supabase/
    host_mapping.sql         integrator edits: net_people view, net_is_staff()
    migrations/              <timestamp>_network_*.sql
    seed_demo.sql            demo data, never part of the bundle
    tests/                   SQL tests (privacy matrix, RLS)
  dist/network_install.sql   generated single-file bundle
  dist/network_uninstall.sql
  tools/
    card-manifest/           token generator, vendor CSV, hash import
    rls-probe/               anon-key probe
    build-sql-bundle.mjs
    check-bundle-size.mjs
  scripts/install-into-host.mjs
  harness/                   dev harness (only if no host repo available)
  docs/                      PRD, specs, DECISIONS.md, HOST_RECON.md, STATUS.md,
                             ADMIN_RUNBOOK.md, INTEGRATION_PROOF.md
  .github/workflows/ci.yml   .github/pull_request_template.md
  e2e/                       Playwright flows
```

## 3. The adapter

The only coupling between module and host. Sketch (refine in Phase 3):

```ts
export interface NetworkHostAdapter {
  supabase: SupabaseClientLike;                 // host's existing client
  getUser(): Promise<{ id: string } | null>;
  requireAuth(returnTo: string): void;          // redirect to host sign-in, then back
  navigate(to: string, opts?: { replace?: boolean }): void;
  hostOrigin: string;                           // for building pass links
  getLiveSession?(): Promise<{ id: string; title: string } | null>;
  openCoffeeRequest?(personId: string): void;   // host module; default: info toast
  openAskThread?(personId: string): void;
  openOfficeHours?(personId: string): void;
  onConnectionCreated?(otherId: string, source: string): void;
  isStaff?(): Promise<boolean>;
  analytics?(event: string, props?: Record<string, unknown>): void;
}
```

Rules: no screen reads host state except through this interface; every optional callback has a graceful default; `index.ts` exports `createNetworkModule(adapter)` returning a provider and the screen components.

## 4. Routes the module needs

| Path | Screen | Auth |
|---|---|---|
| `/t/:token` | Tap landing, all states | public shell, then sign-in |
| `/network/map` | Constellation and Overlap (tab) | signed in |
| `/network/pass` | My pass | signed in |
| `/network/scan` | Scan a pass (also a sheet from Network home) | signed in |
| `/network/connections` | My connections, export, After the conference | signed in |
| `/network/people/:id` | Profile screen (also a side panel on desktop) | signed in |
| `/network/settings/visibility` | Visibility sheet as a page for deep links | signed in |
| `/network/desk` | Staff console | staff only |

The existing Network page and the existing profile page stay the host's. The module exports **components** (`NetworkMapCard`, `MapButton`, `VisibilityBanner`, `MyPassButton`) that the integrator places on the host's Network page: this is host edit number 1.

## 5. Host edits allowed (target: three)

1. The host's Network page imports four small components from the module.
2. The host router registers the module's routes (one file for React Router; the module's route files for TanStack Start).
3. A new file `src/network.adapter.ts` created from the template.

Plus, outside the app code: run the SQL bundle, edit `host_mapping.sql` before running it, and add dependencies. Any other edit is a bug in the integration kit.

## 6. What the install script must do

`node scripts/install-into-host.mjs --host ../planos-host [--dry-run] [--force]`

1. Check the host is a clean git working tree on the synced branch; abort otherwise.
2. Detect stack (Vite or TanStack Start) and package manager; print what it found.
3. Create branch `feat/network-module`.
4. Copy `src/features/network/**` and the matching integration files; refuse to overwrite differing files without `--force`.
5. Add the allowed dependencies at pinned versions.
6. Print the remaining manual steps (edit host Network page, run SQL, regenerate types).
7. Stop before committing; print the commands to review, commit and open a PR.
8. Write `NETWORK_INSTALL_REPORT.md` in the host listing every file added or changed.

## 7. Verification the integrator runs

1. `npm run build` in the host passes.
2. Run `tools/rls-probe` against the host's Supabase project (anon key only): must pass.
3. Open `/t/<test token>` signed in on two phones: profile appears, connection appears, undo works.
4. Open `/network/map`: map renders with the demo seed or real data; list view works.
5. Lovable's own security scan shows no new warnings for `net_` tables.

## 8. Rollback

`dist/network_uninstall.sql` removes all `net_` objects. Reverting the PR removes the front end. The kill switch (`net_feature_flags`) disables tap and map instantly without a deploy.
