#!/usr/bin/env node
// Bundle budgets (DoD, acceptance-tests.md section 3):
//   1. Graph chunk (d3 + graph code) <= 100 kB gzipped, from the harness build in dist-web/.
//   2. Module code added EAGERLY to the host's main bundle < 60 kB gzipped: builds src/features/network as a
//      library with react/react-dom external and measures the entry chunk (lazy chunks excluded).
//   3. No service-role key or "service_role" JWT anywhere in the built client code.
import { build } from "vite";
import react from "@vitejs/plugin-react";
import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const kb = (n) => (n / 1024).toFixed(1);
const gz = (file) => gzipSync(readFileSync(file)).length;
let failed = false;

const assets = join(root, "dist-web", "assets");
const files = readdirSync(assets).filter((f) => f.endsWith(".js"));
const graph = files.find((f) => f.startsWith("net-graph-"));
const map = files.find((f) => f.startsWith("MapScreen-"));
if (!graph) {
  console.error("✗ no net-graph chunk found; run `pnpm build` first");
  process.exit(1);
}
const graphGz = gz(join(assets, graph));
const mapGz = map ? gz(join(assets, map)) : 0;
console.log(`graph chunk        ${graph}: ${kb(graphGz)} kB gz (budget 100 kB)`);
console.log(`map route total    graph + MapScreen: ${kb(graphGz + mapGz)} kB gz`);
if (graphGz > 100 * 1024) { console.error("✗ graph chunk over budget"); failed = true; }

const out = join(root, "node_modules", ".cache", "net-lib");
rmSync(out, { recursive: true, force: true });
await build({
  configFile: false,
  logLevel: "silent",
  plugins: [react()],
  resolve: { alias: [{ find: /^@\//, replacement: join(root, "src") + "/" }] },
  build: {
    outDir: out,
    lib: { entry: join(root, "src/features/network/index.tsx"), formats: ["es"], fileName: "network" },
    rollupOptions: { external: ["react", "react-dom", "react/jsx-runtime", /^@supabase\//] },
    minify: "esbuild",
  },
});
const libFiles = readdirSync(out).filter((f) => f.endsWith(".js"));
const entry = libFiles.find((f) => f.startsWith("network"));
// Eager = the entry plus everything it imports statically (transitively). import() targets are lazy.
const eager = new Set();
const visit = (f) => {
  if (eager.has(f)) return;
  eager.add(f);
  const text = readFileSync(join(out, f), "utf8");
  for (const m of text.matchAll(/(?:^|[;\n}])\s*import\s*(?:[^"'()]*?from\s*)?["']\.\/([^"']+\.js)["']/g)) visit(m[1]);
};
visit(entry);
const eagerGz = [...eager].reduce((s, f) => s + gz(join(out, f)), 0);
const lazy = libFiles.filter((f) => !eager.has(f));
const lazyGz = lazy.reduce((s, f) => s + gz(join(out, f)), 0);
console.log(`module eager       ${eager.size} files (${[...eager].join(", ")}): ${kb(eagerGz)} kB gz (budget 60 kB)`);
console.log(`module lazy chunks ${lazy.length} files: ${kb(lazyGz)} kB gz (loaded only when a screen opens)`);
if (eagerGz > 60 * 1024) { console.error("✗ module eager size over budget"); failed = true; }

const leaks = [];
for (const dir of [assets, out]) {
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".js"))) {
    const text = readFileSync(join(dir, f), "utf8");
    if (/service_role/.test(text)) leaks.push(`${f}: "service_role"`);
    for (const m of text.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]*/g)) {
      try {
        if (JSON.parse(Buffer.from(m[1], "base64url").toString()).role === "service_role") leaks.push(`${f}: service-role JWT`);
      } catch { /* not a JWT */ }
    }
  }
}
console.log(leaks.length ? `✗ service key leak: ${leaks.join(", ")}` : "no service-role key in client bundles");
if (leaks.length) failed = true;
process.exit(failed ? 1 : 0);
