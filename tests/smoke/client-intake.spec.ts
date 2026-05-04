import { execSync } from "node:child_process";
import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";

/**
 * Intake wizard happy path + a Next-button-disabled validation case.
 *
 * Uses the dedicated `client-fresh@test.com` seed user. Each test runs
 * `scripts/reset-fresh-client-intake.js` first to drop any prior interview
 * (cascades drop responses + approvals), so the user always starts with no
 * IntakeInterview row. The reset script needs DATABASE_URL in the same env
 * file the seed scripts read (see scripts/reset-fresh-client-intake.js).
 *
 * The wizard renders 18 questions in production. We use the "Type" tab to
 * answer each, sidestepping audio recording entirely.
 */

test.beforeEach(() => {
  execSync("node scripts/reset-fresh-client-intake.js", {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });
});

test.describe("client intake wizard", () => {
  test("can complete the wizard end-to-end via the Type tab", async ({ page }) => {
    test.setTimeout(180_000);

    await new SignInPage(page).signInAs("clientFresh");

    await page.goto("/intake");
    await expect(page.getByRole("button", { name: /begin interview/i })).toBeVisible();
    await page.getByRole("button", { name: /begin interview/i }).click();

    await page.waitForURL(/\/intake\/interview/, { timeout: 30_000 });

    const counterPattern = /Question (\d+) of (\d+)/i;
    const initialCounter = await page.getByText(counterPattern).first().textContent();
    const match = initialCounter?.match(counterPattern);
    expect(match).not.toBeNull();
    const totalQuestions = Number(match![2]);
    expect(totalQuestions).toBeGreaterThan(0);

    for (let q = 1; q <= totalQuestions; q++) {
      await expect(
        page.getByText(new RegExp(`Question ${q} of ${totalQuestions}`, "i")).first()
      ).toBeVisible();

      await page.getByRole("tab", { name: /type/i }).click();
      const textarea = page.locator("textarea").first();
      await textarea.fill(`Smoke test answer for question ${q}.`);

      const saveButton = page.getByRole("button", { name: /save typed response/i });
      await expect(saveButton).toBeEnabled();
      await saveButton.click();

      if (q < totalQuestions) {
        const nextButton = page.getByRole("button", { name: /^next$/i });
        await expect(nextButton).toBeEnabled({ timeout: 15_000 });
        await nextButton.click();
      }
    }

    await page.waitForURL(/\/intake\/complete/, { timeout: 30_000 });
    expect(new URL(page.url()).pathname).toBe("/intake/complete");
  });

  test("Next is disabled and Save is disabled until a response is typed", async ({ page }) => {
    await new SignInPage(page).signInAs("clientFresh");

    await page.goto("/intake");
    await page.getByRole("button", { name: /begin interview/i }).click();
    await page.waitForURL(/\/intake\/interview/, { timeout: 30_000 });

    await expect(
      page.getByText(/Question 1 of \d+/i).first()
    ).toBeVisible();

    const nextButton = page.getByRole("button", { name: /^next$/i });
    await expect(nextButton).toBeDisabled();

    await page.getByRole("tab", { name: /type/i }).click();
    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible();

    const saveButton = page.getByRole("button", { name: /save typed response/i });
    await expect(saveButton).toBeDisabled();

    await textarea.fill("Just enough to enable save.");
    await expect(saveButton).toBeEnabled();
  });
});
