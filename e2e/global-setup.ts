import { execFileSync } from "node:child_process";

export default function globalSetup() {
  execFileSync("node", ["tools/db.mjs", "setup"], { stdio: "inherit", env: { ...process.env, NET_DB: "net_e2e" } });
}
