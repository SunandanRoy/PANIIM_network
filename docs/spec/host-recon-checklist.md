# Host recon checklist (Phase 0)

Run against a **read-only clone** of the host repository. Record answers in `docs/HOST_RECON.md`, with the file path and line where you found each one. Mark anything you cannot determine `UNKNOWN` and ask in one batch.

## A. Stack
1. Framework and router: React + Vite with React Router, or TanStack Start? Evidence: `package.json`, `vite.config.*`, `src/routes/` or `src/App.tsx`.
2. Package manager and lockfile (`package-lock.json`, `bun.lockb`, `pnpm-lock.yaml`). Node version (`.nvmrc`, `engines`).
3. React, TypeScript, Tailwind, shadcn/ui versions. `tailwind.config.*`, `components.json`, `src/index.css` tokens (colours, radius, fonts).
4. State and data libraries already present (TanStack Query? Zustand?). Reuse, do not add.
5. Is a QR or canvas library already installed? Is `d3-*` present?

## B. Backend
6. Supabase client file and how it is imported. Is it auto-generated (header comment)? Project URL source (env var names only; never read or print values).
7. Supabase types file location. Which tables exist (list names and columns of those relevant to people).
8. Where do name, institute, role, photo, email, phone, paper title, session, room live? Which table or tables, which columns.
9. How is "presenter" determined? How is "registered delegate" determined?
10. Programme and sessions: tables, columns, start times, rooms, speakers. Is there a "starred sessions" table?
11. Is there already a coffee-request, ask/offer, office-hours, tables or follow-up module? Table names and where accepted requests are stored (the module's `net_record_meeting` and `net_grant_contact` hook into these).
12. Existing RLS: list policies on the tables above. Any table without RLS.
13. Auth: provider (email code, Google, others), the hook or context that exposes the user, existing protected-route helper, where unauthenticated users are redirected and whether a return-URL parameter exists.
14. Roles: how admins or volunteers are identified (a roles table, a flag, a hard-coded email list). This decides `net_is_staff()`.
15. Is `pg_cron` available on the project? (ask the owner; cannot be seen from the repo).
16. Edge Functions already present in `supabase/functions/` and how they are called.

## C. Existing UI
17. How is the Network page implemented: file path, components used, data hooks, where the theme chips, quick actions, session-mates, asks and offers sections come from.
18. Existing profile page or sheet, if any: file path.
19. Layout components: header, bottom navigation, page container, toast system.
20. Does the app already have a design-token set for the theme colours of research tracks?

## D. Delivery
21. Default branch name and branch protection. Whether Lovable currently shows the repo as in sync (the owner checks the sync card in Lovable).
22. CI present? Deployment target (Lovable publish, other host)?
23. Domain used for pass links (`paniim.planos.in`) and whether `/t/*` could collide with an existing route or a static host rewrite rule (SPA fallback must serve `index.html` for `/t/*`).

## E. Output
Write `docs/HOST_RECON.md` with: summary (stack in one line), a table of answers, a list of UNKNOWNs, the proposed `net_people` SELECT, the proposed `net_is_staff()`, the exact host edits, and anything that contradicts `docs/spec/*`. Do not write code until Gate A.
