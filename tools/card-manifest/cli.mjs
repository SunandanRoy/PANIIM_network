#!/usr/bin/env node
// Card manifest generator (K-12). Writes to the git-ignored out/ folder ONLY:
//   out/<batch>/vendor.csv     RAW TOKENS: send to the card vendor only (NDEF URL, QR payload, printed code)
//   out/<batch>/import.json    hashes only: import in the desk console (Cards > Import) or with import.sql
//   out/<batch>/import.sql     hashes only: paste into the Supabase SQL editor
//   out/<batch>/summary.txt    counts, checksums, NDEF size check
// Raw tokens are never printed to the terminal and never stored in the database.
//
// node tools/card-manifest/cli.mjs --count 1000 --batch B1 [--spares 10] [--chip ntag213]
//      [--origin https://paniim.planos.in] [--roster names.txt] [--force]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { generate, hashToken, ndefBytes, toCsv } from "./lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const argv = process.argv.slice(2);
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const flag = (k) => argv.includes(`--${k}`);

const count = Number(opt("count"));
const batch = opt("batch");
const sparePct = Number(opt("spares", "10"));
const chip = opt("chip", "ntag213");
const origin = opt("origin", "https://paniim.planos.in");
if (!Number.isInteger(count) || count < 1 || !batch || !/^[A-Za-z0-9_-]{1,20}$/.test(batch)) {
  console.error("usage: cli.mjs --count <N delegates> --batch <name> [--spares 10] [--chip ntag213|ntag215|ntag216|ntag424] [--origin URL] [--roster file] [--force]");
  process.exit(2);
}
if (!["ntag213", "ntag215", "ntag216", "ntag424"].includes(chip)) {
  console.error("chip must be ntag213, ntag215, ntag216 or ntag424");
  process.exit(2);
}
if (!/^https:\/\//.test(origin)) {
  console.error("origin must start with https://");
  process.exit(2);
}

const outDir = join(root, "out", batch);
if (relative(join(root, "out"), outDir).startsWith("..")) process.exit(2);
if (existsSync(outDir) && !flag("force")) {
  console.error(`${relative(root, outDir)} exists. Use --force to overwrite (old tokens would be lost).`);
  process.exit(1);
}
const roster = opt("roster") ? readFileSync(opt("roster"), "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [];

const { rows, total } = generate({ count, sparePct, origin, batch, chip, roster });
const capacity = { ntag213: 144, ntag215: 504, ntag216: 888, ntag424: 256 }[chip];
const maxNdef = Math.max(...rows.map((r) => ndefBytes(r.url)));

mkdirSync(outDir, { recursive: true });
const vendor = toCsv(["serial", "ndef_uri", "qr_payload", "printed_code", "printed_name", "lock_after_write"],
  rows.map((r) => [r.serial, r.url, r.url, r.code, r.printed_name, "yes"]));
const importRows = rows.map((r) => ({ token_hash: hashToken(r.token), printed_code: r.code, chip, batch }));
const importJson = JSON.stringify(importRows);
const importSql =
  `-- pan-iim-network card import, batch ${batch}. Hashes only. Run after dist/network_install.sql.\n` +
  `insert into public.net_cards (token_hash, printed_code, chip, batch) values\n` +
  importRows.map((r) => `  (decode('${r.token_hash}', 'hex'), '${r.printed_code}', '${chip}', '${batch}')`).join(",\n") +
  `\non conflict do nothing;\n`;
const sha = (s) => createHash("sha256").update(s).digest("hex");
writeFileSync(join(outDir, "vendor.csv"), vendor, { mode: 0o600 });
writeFileSync(join(outDir, "import.json"), importJson);
writeFileSync(join(outDir, "import.sql"), importSql);
const summary = [
  `batch           ${batch}`,
  `delegates (N)   ${count}`,
  `spares          ${total - count} (${sparePct}%)`,
  `cards total     ${total}  (= ceil(${1 + sparePct / 100} x N))`,
  `chip            ${chip} (${capacity} bytes user memory)`,
  `NDEF max size   ${maxNdef} bytes ${maxNdef <= capacity ? "OK" : "TOO LARGE"}`,
  `unique tokens   ${new Set(rows.map((r) => r.token)).size}`,
  `unique codes    ${new Set(rows.map((r) => r.code)).size}`,
  `vendor.csv      sha256 ${sha(vendor)}  CONTAINS RAW TOKENS: vendor only, delete after goods-in`,
  `import.json     sha256 ${sha(importJson)}`,
  `import.sql      sha256 ${sha(importSql)}`,
].join("\n");
writeFileSync(join(outDir, "summary.txt"), summary + "\n");
console.log(summary);
console.log(`\nWritten to ${relative(root, outDir)}/ (git-ignored). Raw tokens were not printed.`);
if (maxNdef > capacity) process.exit(1);
