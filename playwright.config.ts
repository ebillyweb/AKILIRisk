import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

/** Playwright compiles this config as CJS — avoid `import.meta`. Walk up from cwd to find the repo root. */
function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (
      existsSync(resolve(dir, "package.json")) &&
      existsSync(resolve(dir, "playwright.config.ts"))
    ) {
      return dir;
    }
    const next = dirname(dir);
    if (next === dir) break;
    dir = next;
  }
  return process.cwd();
}

// Smoke tests shell out to `node scripts/*.js`; those files call dotenv, but
// `execSync` only inherits this process env — load repo env here too.
const root = repoRoot();
loadEnv({ path: resolve(root, ".env.local"), quiet: true });
loadEnv({ path: resolve(root, ".env"), quiet: true });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "https://preview.akilirisk.com";

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/playwright-global-setup.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
