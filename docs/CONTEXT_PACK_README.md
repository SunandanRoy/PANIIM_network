# Pan-IIM Network module: context pack for Claude Code

This folder is everything Claude Code needs to build the `pan-iim-network` repository, so the Network features (NFC tap card, constellation, overlap view) can be brought into the Lovable-built Pan-IIM app.

## What is in the pack

| Path | What it is |
|---|---|
| `KICKOFF_PROMPT.md` | The prompt you paste into Claude Code. Phased, with approval gates |
| `CLAUDE.md` | Standing rules; Claude Code copies it into the new repo's root |
| `docs/prd/PRD-v0.2.md` (+ `.docx`) | Product requirements v0.2 |
| `docs/prd/tickets.csv`, `tickets.json` | 60 tickets with priorities, dependencies, acceptance criteria |
| `docs/spec/data-contract.md` | Tables, RPCs, host mapping view, similarity, retention |
| `docs/spec/privacy-matrix.md` | Who sees what, evaluation order, the 96-case test plan |
| `docs/spec/integration-contract.md` | What Lovable allows, target repo layout, adapter, install script, rollback |
| `docs/spec/host-recon-checklist.md` | What Claude Code must find out about the existing app first |
| `docs/spec/acceptance-tests.md` | End-to-end and non-functional tests |
| `docs/design/wireframes/` | Your six Network wireframes (PDF and PNG) |
| `docs/design/mockups/` | Four mockups of the new screens |
| `docs/design/figma/` | The Figma Make prompt and your Figma exports (add them, see `NOTES.md`) |

## Before you start: five things to line up

1. **The host repository.** Lovable creates a GitHub repo for every project. Ask whoever owns the Pan-IIM Lovable project for the repo URL (Project settings, Git, GitHub in Lovable) and for **read** access for you. Clone it next to this folder. Claude Code will read it, never write to it. This single step answers the biggest unknowns (Vite or TanStack Start, table names, auth, styling).
2. **Tools on your machine.** Claude Code, Git, Node (the version the host uses), Docker (Claude Code runs a local database for tests), and the GitHub CLI signed in (`gh auth login`) so it can create your private repo at the end.
3. **Your Figma.** Drop your frames and Figma Make code export into `docs/design/figma/` as described in `docs/design/figma/NOTES.md`. If you have connected Figma's MCP server to Claude Code, you can also give it frame links.
4. **Four decisions (defaults are built in).** Whether a tap shows contact details (default: no, after the owner accepts); who can see delegates by default (default: presenters); which meetings count as a connection (default: tap, scan, accepted coffee); whether the physical card carries a printed name or is activated by the delegate (default: activated). Change any default by telling Claude Code at Gate A.
5. **Do not give Claude Code** the Supabase service-role key, production passwords or the Lovable login. It does not need them. It works against a local database and hands you SQL to run on the real project.

## How to run it

1. Create a folder (for example `pan-iim-network`) and unzip this pack into it.
2. Put your Figma files in `docs/design/figma/`.
3. Open a terminal in the folder and start Claude Code (`claude`). Switch to plan mode for the first message.
4. Paste the contents of `KICKOFF_PROMPT.md` (everything below the horizontal line).
5. Answer its first question with the host repo path. Then review at each gate:
   - **Gate A:** its read of the host app and its plan.
   - **Gate B:** the SQL, before it touches anything real.
   - **Gate C:** a demo of the map and overlap with demo data.
   - **Gate D:** the integration kit, with proof it installed into a fresh copy of the host.
   - **Gate E:** publishing the private GitHub repo.

## What the person on Lovable does later

They follow `INTEGRATION.md` in the finished repo: run the install script against their clone of the host repo, run the SQL bundle (or paste `LOVABLE_PROMPT.md` into Lovable's chat and approve), edit three host files, open a pull request into the synced branch and merge it with a merge commit. Lovable then shows the new code. Lovable does not run the database changes by itself when code syncs, so the SQL step cannot be skipped.

## Honest limits

- The finished repo cannot be "linked" to an existing Lovable project. Lovable's Git sync does not import repositories. The integration is a copy into the host's own repository.
- The host's real column and table names are unknown until Claude Code reads the repo. `net_people` is the one place that mapping lives.
- The plan is tight: the freeze is Wed 25 Nov and the card order is due tonight or tomorrow. Claude Code works P0 first; see the PRD cut order if time runs out.
