import { defineConfig, devices } from "@playwright/test";

// E2E against the dev harness and a fresh local database (net_e2e) seeded with demo data.
const env = { ...process.env, NET_DB: "net_e2e" };
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: { baseURL: "http://127.0.0.1:4173", ...devices["Pixel 7"], trace: "off" },
  webServer: [
    { command: "node harness/api/server.mjs", url: "http://127.0.0.1:54322/harness/users", env: { ...env, NET_API_PORT: "54322" }, reuseExistingServer: false },
    { command: "pnpm exec vite build --config harness/vite.config.ts && pnpm exec vite preview --config harness/vite.config.ts", url: "http://127.0.0.1:4173", env: { ...env, VITE_NET_API_URL: "http://127.0.0.1:54322" }, reuseExistingServer: false, timeout: 120_000 },
  ],
});
