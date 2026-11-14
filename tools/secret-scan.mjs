#!/usr/bin/env node
// Secret scan of tracked files and the whole git history (CI also runs gitleaks). Fails on:
// service-role JWTs, Supabase secret keys, private keys, cloud keys, committed .env files or out/ manifests.
import { execFileSync } from "node:child_process";

const git = (...a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const rules = [
  { id: "supabase-secret-key", re: /sb_secret_[A-Za-z0-9_-]{20,}/ },
  { id: "private-key", re: /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/ },
  { id: "aws-access-key", re: /AKIA[0-9A-Z]{16}/ },
  { id: "github-token", re: /gh[pousr]_[A-Za-z0-9]{36,}/ },
  { id: "service-role-assignment", re: /SERVICE_ROLE_KEY\s*[=:]\s*["']?eyJ/ },
  { id: "postgres-url-with-password", re: /postgres(?:ql)?:\/\/[^:\s]+:(?!postgres@)[^@\s]{6,}@(?!localhost|127\.0\.0\.1)/ },
];
function jwtLeak(text) {
  for (const m of text.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g)) {
    try {
      if (JSON.parse(Buffer.from(m[1], "base64url").toString()).role === "service_role") return true;
    } catch { /* not a JWT */ }
  }
  return false;
}

const findings = [];
const files = git("ls-files").split("\n").filter(Boolean);
for (const f of files) {
  if (/(^|\/)\.env(\.|$)/.test(f) && !f.endsWith(".example")) findings.push(`${f}: .env file is tracked`);
  if (/^out\//.test(f)) findings.push(`${f}: card manifest output is tracked`);
}
const history = git("log", "--all", "-p", "--no-color", "--no-ext-diff");
for (const r of rules) if (r.re.test(history)) findings.push(`history: ${r.id}`);
if (jwtLeak(history)) findings.push("history: service-role JWT");

if (findings.length) {
  console.error("✗ secret scan found:\n  " + findings.join("\n  "));
  process.exit(1);
}
console.log(`no secrets in ${files.length} tracked files or ${git("rev-list", "--all", "--count").trim()} commits`);
