# Figma material for Claude Code

## What to put in this folder

1. **Frame exports.** In Figma, select the Network frames and export as PNG at 2x. Name them in screen order, for example `01-network-home.png`, `02-profile.png`, `03-tap-states.png`, `04-constellation.png`, `05-overlap.png`, `06-visibility.png`, `07-desk-console.png`. Claude Code reads images directly.
2. **Figma Make code export** (if you generated a prototype from `figma-make-prompt.txt`): download the generated project, unzip it into `docs/design/figma/make-export/`. Do not commit it to the final repository.
3. **Links.** A file `links.md` with the Figma file and Make links, one per line, and a note of which frames are final.
4. **Tokens, if you have them.** Colours, type scale and radii as a short `tokens.md` (the wireframes' values are only my estimate).

## How Claude Code should use it

- The **PNG exports and the six wireframes are the visual source of truth.** Layout, spacing, copy and states come from them.
- The **Make export is a visual and structural reference only.** It is generated code with its own conventions and dependencies. Re-implement each screen with the host's Tailwind tokens and shadcn/ui components, inside `src/features/network/`. Never copy components, styles or dependencies across.
- Where design and PRD disagree, stop and ask. Where design is silent on a state, use the PRD's description and the mockups in `docs/design/mockups/`.

## Optional: Figma MCP server

If you have connected Figma's MCP server to Claude Code, you can give it frame links and it can pull design context directly. Setup instructions are in Figma's documentation: [Figma MCP server](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation). The exports above remain the fallback, because they work without any setup.
