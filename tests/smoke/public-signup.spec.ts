import { execSync } from "node:child_process";
import { PLAYWRIGHT_REPO_ROOT } from "../helpers/repo-root";
import { test, expect } from "@playwright/test";

/**
 * Public signup happy path: visit /start, redeem the unlimited invite code
 * `123456`, complete the signup form with a throwaway email, land on /intake.
 *
 * State management: this test intentionally creates a User row each run.
 * `cleanup-signup-test-users.js` (called in beforeAll AND afterAll) removes
 * any User rows whose email starts with `pw-signup-` so the DB doesn't
 * accumulate cruft.
 */

const INVITE_CODE = "123456";

const scriptEnv = { ...process.env };

test.beforeAll(() => {
  execSync("node scripts/cleanup-signup-test-users.js", {
    stdio: "inherit",
    cwd: PLAYWRIGHT_REPO_ROOT,
    env: scriptEnv,
  });
});

test.afterAll(() => {
  execSync("node scripts/cleanup-signup-test-users.js", {
    stdio: "inherit",
    cwd: PLAYWRIGHT_REPO_ROOT,
    env: scriptEnv,
  });
});

test.describe("public signup", () => {
  test("/start invite redemption + /signup creates user that lands on /intake", async ({ page }) => {
    test.setTimeout(60_000);

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const email = `pw-signup-${stamp}@test.com`;
    const password = "Pw-signup-Test1!";

    await page.goto("/start");
    await page.getByText(/Enter invite code/i).first().waitFor();

    // The OTP boxes ignore programmatic .fill() - they need real keystrokes
    // routed through the focused first box for the React handler to advance.
    await page.locator('input[autocomplete="one-time-code"]').first().click();
    await page.keyboard.type(INVITE_CODE, { delay: 30 });

    await page.getByRole("button", { name: /continue to create account/i }).click();
    await page.waitForURL(/\/signup\?invite=.*callbackUrl=%2Fintake/);

    await page.locator("#firstName").fill("Pw");
    await page.locator("#lastName").fill("Signup");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.locator("#confirmPassword").fill(password);

    await page.getByRole("button", { name: /^create account$/i }).click();

    await page.waitForURL(/\/intake(\/|$|\?)/, { timeout: 30_000 });
    expect(new URL(page.url()).pathname).toMatch(/^\/intake/);

    await expect(
      page.getByRole("button", { name: /begin interview/i })
    ).toBeVisible();
  });

  test("signup with an existing email surfaces an error and does not redirect", async ({ page }) => {
    await page.goto("/start");
    await page.locator('input[autocomplete="one-time-code"]').first().click();
    await page.keyboard.type(INVITE_CODE, { delay: 30 });
    await page.getByRole("button", { name: /continue to create account/i }).click();
    await page.waitForURL(/\/signup\?invite=/);

    await page.locator("#firstName").fill("Pw");
    await page.locator("#lastName").fill("Duplicate");
    await page.locator("#email").fill("advisor@test.com");
    await page.locator("#password").fill("Pw-test-1234!");
    await page.locator("#confirmPassword").fill("Pw-test-1234!");
    await page.getByRole("button", { name: /^create account$/i }).click();

    await expect(page.getByText(/Unable to create account/i)).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/signup");
  });

  test("signup form rejects mismatched passwords", async ({ page }) => {
    await page.goto("/start");
    await page.locator('input[autocomplete="one-time-code"]').first().click();
    await page.keyboard.type(INVITE_CODE, { delay: 30 });
    await page.getByRole("button", { name: /continue to create account/i }).click();
    await page.waitForURL(/\/signup\?invite=/);

    await page.locator("#firstName").fill("Pw");
    await page.locator("#lastName").fill("Mismatch");
    await page.locator("#email").fill(`pw-signup-${Date.now()}-mm@test.com`);
    await page.locator("#password").fill("Pw-test-1234!");
    await page.locator("#confirmPassword").fill("DIFFERENT-PASSWORD!");
    await page.getByRole("button", { name: /^create account$/i }).click();

    await expect(page.getByText(/Passwords do not match/i)).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/signup");
  });
});
