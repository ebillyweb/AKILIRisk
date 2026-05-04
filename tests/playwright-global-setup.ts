import { chromium, type FullConfig } from "@playwright/test";

/**
 * Fail fast with one actionable error instead of dozens of browserType.launch
 * failures when Chromium hasn't been installed for this @playwright/test revision.
 */
export default async function globalSetup(_config: FullConfig) {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes("Executable doesn't exist") ||
      msg.includes("browserType.launch")
    ) {
      console.error(`
----------------------------------------------------------------------
Playwright Chromium is missing or out of date for this install.

  npm run test:e2e:install

Run that from the repo root, then retry.
----------------------------------------------------------------------
`);
    }
    throw err;
  } finally {
    await browser?.close();
  }
}
