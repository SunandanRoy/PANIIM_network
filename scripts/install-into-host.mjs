#!/usr/bin/env node
// Copies the Network module into a clone of the Lovable host repo (integration-contract section 6).
//
//   node scripts/install-into-host.mjs --host ../paniim-host [--dry-run] [--force] [--stack vite|tanstack]
//        [--synced-branch main] [--branch feat/network-module]
//
// 1. checks the host is a clean git tree on the synced branch   2. detects stack and package manager
// 3. creates the feature branch   4. copies files, refusing to overwrite a different file unless --force
// 5. adds the 4 pinned dependencies to package.json   6. writes NETWORK_INSTALL_REPORT.md
// 7. prints the remaining manual steps and STOPS BEFORE COMMITTING.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DEPENDENCIES = { "d3-force": "3.0.0", jsqr: "1.4.0", "qrcode-generator": "2.0.4" };
export const DEV_DEPENDENCIES = { "@types/d3-force": "3.0.10" };

const here = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};
const flag = (k) => argv.includes(`--${k}`);
const dry = flag("dry-run");
const force = flag("force");
const hostArg = opt("host");
if (!hostArg) {
  console.error("usage: install-into-host.mjs --host <path to host clone> [--dry-run] [--force] [--stack vite|tanstack] [--synced-branch main] [--branch feat/network-module]");
  process.exit(2);
}
const host = resolve(hostArg);
const say = (s = "") => console.log(s);
const fail = (s) => {
  console.error(`✗ ${s}`);
  process.exit(1);
};
const git = (...a) => execFileSync("git", ["-C", host, ...a], { encoding: "utf8" }).trim();

// 1. host checks
if (!existsSync(join(host, "package.json"))) fail(`${host} has no package.json`);
try { git("rev-parse", "--git-dir"); } catch { fail(`${host} is not a git repository`); }
const synced = opt("synced-branch", "main");
const current = git("rev-parse", "--abbrev-ref", "HEAD");
if (git("status", "--porcelain")) fail("host working tree is not clean; commit or stash first");
if (current !== synced) fail(`host is on '${current}', expected the synced branch '${synced}' (use --synced-branch)`);

// 2. detect stack and package manager
const pkg = JSON.parse(readFileSync(join(host, "package.json"), "utf8"));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
const detected = deps["@tanstack/react-start"] || deps["@tanstack/start"] ? "tanstack" : deps["react-router-dom"] || deps["react-router"] ? "vite" : null;
const stack = opt("stack", detected);
if (!stack) fail("could not detect the stack (no @tanstack/react-start or react-router-dom); pass --stack vite|tanstack");
if (!["vite", "tanstack"].includes(stack)) fail("--stack must be vite or tanstack");
const pm = existsSync(join(host, "bun.lockb")) || existsSync(join(host, "bun.lock")) ? "bun"
  : existsSync(join(host, "pnpm-lock.yaml")) ? "pnpm" : existsSync(join(host, "yarn.lock")) ? "yarn" : "npm";
const reactMajor = Number(String(deps.react ?? "").replace(/[^\d.]/g, "").split(".")[0] || 0);
const tsconfigText = ["tsconfig.app.json", "tsconfig.json"].map((f) => join(host, f)).filter(existsSync).map((f) => readFileSync(f, "utf8")).join("\n");
const hasAlias = /"@\/\*"\s*:\s*\[\s*"\.?\/?src\/\*"\s*\]/.test(tsconfigText);
const twConfig = ["tailwind.config.ts", "tailwind.config.js", "tailwind.config.cjs", "tailwind.config.mjs"].map((f) => join(host, f)).find(existsSync);
const twCoversSrc = twConfig ? /\.\/src\/\*\*\/\*\.\{[^}]*tsx/.test(readFileSync(twConfig, "utf8")) : null;

say(`host            ${host}`);
say(`stack           ${stack === "vite" ? "React + Vite (React Router)" : "TanStack Start"}${opt("stack") ? " (forced)" : ""}`);
say(`package manager ${pm}`);
say(`react           ${deps.react ?? "?"}${reactMajor && reactMajor < 18 ? "  ✗ module needs React 18 or later" : ""}`);
say(`alias @/ -> src ${hasAlias ? "yes" : "NOT FOUND: add \"@/*\": [\"./src/*\"] to tsconfig paths and a matching vite alias"}`);
say(`tailwind        ${twConfig ? (twCoversSrc ? `${relative(host, twConfig)} scans ./src/**` : `${relative(host, twConfig)}: make sure content includes ./src/**/*.{ts,tsx}`) : "no tailwind.config (Tailwind v4 scans sources automatically)"}`);
say(dry ? "mode            DRY RUN: nothing will be written" : "mode            write");
say();

// 3. branch
const branch = opt("branch", "feat/network-module");
const branchExists = (() => { try { git("rev-parse", "--verify", "--quiet", `refs/heads/${branch}`); return true; } catch { return false; } })();
if (branchExists) fail(`branch ${branch} already exists in the host; delete it or pass --branch`);
if (!dry) git("switch", "-c", branch);
say(`${dry ? "would create" : "created"} branch ${branch}`);

// 4. copy
function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const plan = [];
for (const f of walk(join(here, "src/features/network"))) {
  if (/\.test\.(ts|tsx|mjs)$/.test(f)) continue;
  plan.push([f, join(host, relative(here, f))]);
}
const integ = join(here, "integration", stack === "vite" ? "vite-react-router" : "tanstack-start", "src");
for (const f of walk(integ)) plan.push([f, join(host, "src", relative(integ, f))]);
plan.push([join(here, "dist/migrations/20261114000100_network_install.sql"), join(host, "supabase/migrations/20261114000100_network_install.sql")]);
for (const f of ["dist/network_install.sql", "dist/network_uninstall.sql", "supabase/host_mapping.sql"]) {
  plan.push([join(here, f), join(host, "supabase/network", f.split("/").pop())]);
}

const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const added = [], same = [], replaced = [], conflicts = [];
for (const [src, dst] of plan) {
  if (!existsSync(src)) fail(`missing source ${relative(here, src)}; run pnpm build:sql first`);
  if (existsSync(dst)) {
    if (sha(src) === sha(dst)) { same.push(dst); continue; }
    if (!force) { conflicts.push(dst); continue; }
    replaced.push(dst);
  } else added.push(dst);
  if (!dry) {
    mkdirSync(dirname(dst), { recursive: true });
    writeFileSync(dst, readFileSync(src));
  }
}
if (conflicts.length) {
  if (!dry) git("switch", synced);
  if (!dry) try { git("branch", "-D", branch); } catch { /* ignore */ }
  fail(`refusing to overwrite ${conflicts.length} file(s) that differ (use --force after checking):\n  ${conflicts.map((c) => relative(host, c)).join("\n  ")}`);
}
say(`${dry ? "would add" : "added"} ${added.length} files, ${replaced.length} replaced, ${same.length} already identical`);

// 5. dependencies
const changedDeps = [];
pkg.dependencies = pkg.dependencies ?? {};
for (const [name, version] of Object.entries(DEPENDENCIES)) {
  if (pkg.dependencies[name] !== version) {
    changedDeps.push(`${name}@${version}${pkg.dependencies[name] ? ` (was ${pkg.dependencies[name]})` : ""}`);
    pkg.dependencies[name] = version;
  }
}
pkg.devDependencies = pkg.devDependencies ?? {};
for (const [name, version] of Object.entries(DEV_DEPENDENCIES)) {
  if (pkg.devDependencies[name] !== version && pkg.dependencies[name] !== version) {
    changedDeps.push(`${name}@${version} (dev)`);
    pkg.devDependencies[name] = version;
  }
}
if (!dry && changedDeps.length) writeFileSync(join(host, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
say(`${dry ? "would add" : "added"} dependencies: ${changedDeps.join(", ") || "none (already present)"}`);

// 6. report
const installCmd = { npm: "npm install", pnpm: "pnpm install", yarn: "yarn install", bun: "bun install" }[pm];
const edit1 = stack === "vite"
  ? `src/App.tsx:\n     import { NetworkRoot, networkRoutes } from "./network.routes";\n     ...wrap <Routes> in <NetworkRoot> ... and inside <Routes>: {networkRoutes()}`
  : `src/routes/__root.tsx:\n     import { NetworkRoot } from "../network.root";\n     ...wrap <Outlet /> in <NetworkRoot>`;
const steps = `
Remaining manual steps (see INTEGRATION.md in the pan-iim-network repo):

  1. Host edit 1, the Network page: import and place the four components
       import { MyPassButton, VisibilityBanner, NetworkMapCard, MapButton } from "@/features/network";
  2. Host edit 2, ${edit1}
  3. Host edit 3, src/network.adapter.ts was created from the template: fix the lines marked ADJUST.
  4. Edit supabase/network/host_mapping.sql for the host's tables (docs/HOST_RECON.md), then rebuild the
     bundle in the pan-iim-network repo (NET_HOST_MAPPING=<path> pnpm build:sql) or paste your mapping into
     the "host_mapping.sql" section of supabase/network/network_install.sql.
  5. Run the SQL: Supabase SQL editor, or paste LOVABLE_PROMPT.md into Lovable's chat and approve.
  6. ${installCmd} && ${pm === "npm" ? "npm run" : pm} build
  7. Review, then commit and open a PR into ${synced} (merge with a merge commit, never squash/rebase):
       git -C ${host} add -A && git -C ${host} commit -m "feat: Pan-IIM Network module"
       git -C ${host} push -u origin ${branch}
`;
const report = `# Network module install report

- Date: ${new Date().toISOString()}
- Stack: ${stack}; package manager: ${pm}; branch: ${branch} from ${synced}
- Dependencies added to package.json: ${changedDeps.join(", ") || "none"}

## Files added (${added.length})
${added.map((f) => `- ${relative(host, f)}`).join("\n")}

## Files replaced with --force (${replaced.length})
${replaced.map((f) => `- ${relative(host, f)}`).join("\n") || "- none"}

## Files already identical (${same.length})
${same.map((f) => `- ${relative(host, f)}`).join("\n") || "- none"}
${steps}`;
if (!dry) writeFileSync(join(host, "NETWORK_INSTALL_REPORT.md"), report);
say(`${dry ? "would write" : "wrote"} NETWORK_INSTALL_REPORT.md`);
say(steps);
say(dry ? "Dry run complete. Nothing was changed." : "Stopped before committing. Nothing was pushed.");
