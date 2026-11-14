# Kickoff prompt for Claude Code

Paste everything below the line into Claude Code, started in an empty folder that contains this context pack (see README.md). Start Claude Code in plan mode for the first message.

---

You are building **`pan-iim-network`**: a self-contained feature module, delivered as a GitHub repository, that adds NFC tap cards, a connection constellation and a theme-overlap (Venn-style) view to the "Network" section of the Pan-IIM WMC 2026 community app (https://paniim.planos.in/, IIM Shillong, event 27 to 29 November 2026). The host app is built on **Lovable**. A person working on the host app must be able to bring this module into the host's GitHub repository and have the Network features work, with the smallest possible number of edits to host files.

Today is Sat 14 Nov 2026. The software freeze is Wed 25 Nov. Build P0 first, then P1, then P2. Everything is time-boxed, so do not gold-plate.

## 1. Read these first, in this order

1. `CLAUDE.md` (copy it to the repo root now; it holds the standing rules).
2. `docs/prd/PRD-v0.2.md`. It is the product source of truth. Section 5 is the screen-level specification, section 6 the card, connection and privacy rules, section 7 the architecture. The original Word file is next to it.
3. `docs/prd/tickets.csv` and `tickets.json`: 60 tickets (K-01 to K-83) with priorities, dependencies and acceptance criteria. Use the IDs in commit messages and PR titles.
4. `docs/spec/*.md`: `data-contract.md`, `privacy-matrix.md`, `integration-contract.md`, `acceptance-tests.md`, `host-recon-checklist.md`. Where these are more specific than the PRD, they win. Where they add something the PRD does not say, they say so.
5. `docs/design/wireframes/` (the six existing Network wireframes, the source of truth for layout and copy), `docs/design/mockups/` (my mockups of the new screens), and `docs/design/figma/` (the Figma Make prompt and whatever Figma exports I have added).

If any of these files is missing or unreadable, tell me before continuing.

## 2. Facts about the host that shape everything (do not ignore)

These come from Lovable's documentation (links in `docs/spec/integration-contract.md`). Treat them as constraints.

- **You cannot import a repository into an existing Lovable project.** Lovable's Git sync only exports. The host repo already exists on GitHub because Lovable created it. The integrator brings your code in by committing it to the host repo's **synced branch** (normally `main`), usually through a pull request from a feature branch. Commits on the synced branch then appear in Lovable.
- **Lovable does not run migration files or deploy Edge Functions when commits sync.** The integrator must either run the SQL themselves (Supabase SQL editor or CLI) or ask Lovable, in its chat, to apply it. So: ship the database as one reviewed, idempotent SQL bundle plus a ready-to-paste Lovable chat prompt, and **do not depend on Edge Functions** in v1.
- **Two possible host stacks.** Lovable projects created from 13 May 2026 use TanStack Start; older projects use React + Vite. I do not yet know which this host is. Your first job (Phase 0) is to find out. The module must not hard-code either router.
- Lovable regenerates some files (typically `src/integrations/supabase/client.ts` and `types.ts`). Never edit them. Do not import host `Database` types; define your own types for the module's RPCs.
- Lovable runs a dependency audit when commits sync. Keep new dependencies to the minimum and list each in `INTEGRATION.md`.
- Missing RLS is the commonest way Lovable apps leak data. Security work here is P0, not polish.

## 3. Architecture decisions already made

Do not reopen these unless you find a concrete blocker. If you do, write the objection and your alternative in `docs/DECISIONS.md` and ask me.

1. **One module directory.** All front-end code lives under `src/features/network/`. The module touches host code only through `NetworkHostAdapter`, an interface the host implements in one small file (`src/network.adapter.ts`, written by the integrator from your template). The adapter supplies: the host's Supabase client, the current user, a `requireAuth()` redirect, `navigate()`, the current live session (if any), and optional callbacks such as `openCoffeeRequest(personId)`. Defaults must degrade gracefully (a toast such as "Coffee requests come from the host app") so the module works with an empty adapter.
2. **Router-agnostic UI.** Screens are plain React components that take props and call adapter functions. Provide two thin route bindings in `integration/vite-react-router/` and `integration/tanstack-start/`, each with copy-paste route files. Do not import a router inside `src/features/network/` except through the adapter.
3. **Host styling.** Tailwind and shadcn/ui semantic tokens only (`bg-background`, `text-foreground`, `border`, `primary` and so on), plus a small set of module tokens for theme colours. No new UI library, no global CSS, no CSS reset. Read the host's `tailwind.config` and `components.json` in Phase 0 and match them. Figma Make output is a visual reference only; re-implement with the host's components, never paste generated code in.
4. **Database: additive only, `net_` prefix, `public` schema.** Never `ALTER` a host table. Read host profile data (name, institute, role, photo, email, paper, session) through one integrator-editable view, `net_people`, defined in `supabase/host_mapping.sql`. All module tables have RLS on, **no policies that allow client writes, and no direct table grants** to `anon` or `authenticated`. Clients reach data only through `SECURITY DEFINER` functions (RPCs) with a pinned `search_path` and `EXECUTE` granted explicitly. The table and function list is in `docs/spec/data-contract.md`.
5. **Idempotent, reversible SQL.** `CREATE ... IF NOT EXISTS` and `CREATE OR REPLACE`, one transaction, a `net_schema_version` table, and a matching `uninstall.sql`. Output: `supabase/migrations/<timestamp>_network_*.sql` (for CLI users and Lovable's record) **and** a single concatenated `dist/network_install.sql` for the SQL editor.
6. **No Edge Functions in v1.** Similarity edges refresh in SQL (on profile save and through a function that can be called by `pg_cron` if the host has it enabled, or by hand). The 29 Dec 2026 retention deletion is a SQL function plus documented scheduling options.
7. **Tap is a GET that never writes.** `/t/:token` renders the profile. The connection is created by an authenticated RPC after render, with an 8 second undo. Contact details never appear on a tap unless the owner enabled share-on-tap (default off).
8. **Cards.** One locked, read-only NDEF URI per card: `https://<host>/t/<16-character Crockford base32 token>`. Only the SHA-256 of the token is stored. A CLI in `tools/card-manifest/` generates tokens (N plus 10 percent spares, no duplicates), the vendor CSV and the hash import file. Raw-token files go in an ignored `out/` folder and are never committed.
9. **Graph.** `d3-force` on canvas, lazy-loaded as its own chunk of 100 kB gzipped or less, capped at 300 nodes, pre-settled before first paint, with a list-view equivalent, keyboard operation and reduced-motion support. Venn mode is capped at 3 themes (7 regions).
10. **Privacy order.** Block, then scope, then field rules, always in the server function. Matrix and the 96-case test list are in `docs/spec/privacy-matrix.md`.

## 4. Phases and gates

Work in these phases. At each **GATE**, stop, summarise what exists and what is decided, and wait for my go-ahead. Commit at the end of every phase.

**Phase 0: Recon and plan (GATE A).**
- Ask me for the host repo location. If I give a GitHub URL, clone it **read-only** next to this folder (never push to it). Follow `docs/spec/host-recon-checklist.md` and write `docs/HOST_RECON.md`: stack (Vite or TanStack Start), router, Supabase client file, auth hook, UI kit and tokens, existing tables and columns for profiles, sessions and programme, whether `pg_cron` is available, how routes are registered, how the existing Network page is built, Node and package-manager versions.
- If I cannot give you the host repo, say so, then build against a **dev harness** (`harness/`: Vite + React Router + local Supabase via Docker) and mark every host assumption `ASSUMPTION` in `docs/DECISIONS.md`. Do not guess host column names; centralise them in `net_people` and the adapter.
- Write `docs/PLAN.md`: repo layout, tickets mapped to files, the integration touch points (exact list of host files an integrator must edit, aim for three or fewer), risks, and a day-by-day schedule to Wed 25 Nov. Show me the plan in plan mode.

**Phase 1: Repo skeleton and tooling.** Package setup, TypeScript strict, ESLint, Vitest, Playwright, GitHub Actions CI (typecheck, lint, unit, SQL tests, bundle-size check, secret scan). `CLAUDE.md` in place. Use the same Node version and package manager as the host.

**Phase 2: Database (GATE B).** Tables, `net_people` mapping, RLS, grants, RPCs, `uninstall.sql`, the bundle build script. Then tests against a **real local Postgres** (Supabase CLI or Docker), not a mock: RLS probe as `anon` and as an ordinary `authenticated` user, and the full 96-case privacy matrix. Also write `tools/rls-probe` (takes a URL and anon key, asserts zero rows from every `net_` table and zero writes). I review the SQL before anything touches a real project.

**Phase 3: Domain layer and adapter.** Typed RPC wrappers, hooks, the `NetworkHostAdapter` interface and a no-op default adapter, error handling, an offline retry queue for `connect`.

**Phase 4: Screens (P0 first).** In this order: tap landing states, profile screen, activation, My pass, scan sheet (QR plus code entry; the QR scanner library must be a lazy chunk), visibility sheet, block and report, Network home additions (map preview, Map button, banner states, My pass entry). Follow the wireframes for layout and copy. Add component tests and Playwright flows from `docs/spec/acceptance-tests.md`.

**Phase 5: Constellation and Overlap (GATE C, demo).** Graph, peek card, path highlight, filters, list view, empty states, Overlap with seven regions. Provide a seeded demo dataset (`supabase/seed_demo.sql`, clearly marked as demo-only and excluded from the install bundle) so I can see the full experience.

**Phase 6: Desk console and tooling.** Staff console (bind, unbind, revoke, lost-card swap, CSV export, report queue, metrics, kill switch), card-manifest CLI, retention function with a dry-run mode.

**Phase 7: Integration kit (GATE D).** Write the kit so a person who has never seen this code can install it in under an hour:
- `INTEGRATION.md`: prerequisites, a numbered install procedure, the exact host edits, how to verify, how to roll back.
- `scripts/install-into-host.mjs`: given a path to a clone of the host repo, creates a branch `feat/network-module`, copies the module and integration files, adds the dependencies, prints the remaining manual steps, and stops before committing. It must refuse to overwrite a file that differs unless `--force` is given, and must support `--dry-run`.
- `LOVABLE_PROMPT.md`: ready-to-paste text for Lovable's chat that (a) tells Lovable to apply `dist/network_install.sql` with approval and then regenerate types, (b) asks it to run its security check and review RLS on the `net_` tables, and (c) asks it to confirm the new routes build. Keep each request small and explicit.
- `docs/ADMIN_RUNBOOK.md`: card batch, goods-in, desk binding, lost-card, event-day rollback (kill switch), post-event export and the 29 Dec deletion.
- **Prove it:** make a fresh copy of the host (or, failing that, a generated Lovable-style Vite and TanStack Start template), run the install script, run the build and the tests, and paste the output into `docs/INTEGRATION_PROOF.md`.

**Phase 8: Publish (GATE E).** Only after Gate D. Check `gh auth status`. Ask me for the owner and repo name (default suggestion `pan-iim-network`). Create it **private**, push `main`, tag `v0.1.0`, open the first PR from the feature branch with the checklist from `.github/pull_request_template.md`. Do not choose a licence; ask me. Never push to the host repo.

## 5. Definition of done (check before every gate)

- Typecheck, lint, unit tests, SQL tests and Playwright flows pass in CI. Show me the command output, not a claim.
- Graph chunk is 100 kB gzipped or less (script prints the number). The rest of the module adds under 60 kB gzipped to the host's main bundle (my proposed target; confirm or adjust at Gate A).
- No secrets in the repository or history (`gitleaks` or equivalent in CI). No service-role key anywhere in client code. `.env*` ignored.
- Every `net_` table: RLS on, zero client policies, no direct grants. `tools/rls-probe` passes against the local database.
- Accessibility: all tap targets at least 44 px, keyboard path for every map action, colour never the only cue, reduced motion honoured.
- Copy matches the wireframes where they exist. The privacy footer line appears on every profile state.
- Each ticket in `tickets.csv` is either done with its acceptance criterion tested, or listed in `docs/STATUS.md` with the reason.

## 6. Rules of engagement

- **Ask, do not guess,** about the host. List unknowns in `docs/HOST_RECON.md` and ask me in one batch.
- **Stay in scope.** Out of scope: the host's coffee requests, asks and offers board, office hours, tables and outings, programme editing, payments. Provide hooks and stubs only (the adapter callbacks and `record_meeting`).
- **One addition to the PRD, flagged.** The PRD says contact details appear after the owner accepts but does not define where an acceptance is stored. `docs/spec/data-contract.md` adds `net_contact_grants` and `net_grant_contact` for this. Implement it, and tell me in the Gate A summary if you see a better way.
- **Prefer small, reviewable commits** with Conventional Commit messages and ticket IDs (for example `feat(K-23): tap result with undo`).
- **Never touch real data.** No production keys. Use the local database and demo seed only. If something needs a real Supabase project, stop and tell me exactly what to run and where.
- **Honest status.** If a ticket cannot be done in the time, say so with the smallest cut that keeps the main flow working. The cut order is in the PRD section 9.4.
- **Do not paste Figma or Figma Make code into the module.** Use it for look and structure only.

## 7. Final report

When you finish (or at any gate), give me: what is built, ticket status table (done, partial, not started), test and size numbers, the exact list of host edits, anything I must do by hand (SQL to run, cards to order, secrets to set), open questions, and the repository link once it exists.

Start with Phase 0 now. First, confirm you have read the files in section 1, copy `CLAUDE.md` to the repo root, and ask me for the host repository location.
