import { execSync } from "node:child_process";
import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";
import { AdvisorIntakeReviewPage } from "../page-objects/AdvisorIntakeReviewPage";
import { AssessmentHubPage } from "../page-objects/AssessmentHubPage";
import { skipUnlessTestAuth } from "../helpers/test-auth";
import { completeIntakeViaTypeTab } from "../helpers/intake-wizard";
import { USERS } from "../fixtures/users";

/**
 * Epic 5.2 — US-11 advisor intake review and approval.
 */
test.describe("Epic 5.2 — advisor intake approval (US-11)", () => {
  test.beforeEach(async ({ request }) => {
    await skipUnlessTestAuth(request);
    execSync("node scripts/reset-fresh-client-intake.js", {
      stdio: "inherit",
      cwd: process.cwd(),
      env: process.env,
    });
  });

  test("advisor approves submitted intake and client unlocks assessment", async ({
    page,
  }) => {
    test.setTimeout(300_000);

    await new SignInPage(page).signInAs("clientFresh");
    await completeIntakeViaTypeTab(page, { fromLanding: true });

    await page.context().clearCookies();
    await new SignInPage(page).signInAs("advisor");

    await page.goto("/advisor/pipeline");
    const clientLink = page
      .getByRole("link")
      .filter({ hasText: USERS.clientFresh.email })
      .first();
    await clientLink.waitFor({ timeout: 30_000 });
    await page.goto((await clientLink.getAttribute("href"))!);

    const reviewLink = page
      .locator('a[href^="/advisor/review/"]')
      .filter({ hasText: /Review (Responses|Intake)/i })
      .first();
    await reviewLink.click();
    await page.waitForURL(/\/advisor\/review\/[^/]+$/, { timeout: 30_000 });

    const review = new AdvisorIntakeReviewPage(page);
    await review.expectInReviewState();
    await review.selectFocusArea(/^Governance$/i);
    await review.approveWithConfirmation();

    await page.context().clearCookies();
    await new SignInPage(page).signInAs("clientFresh");

    const hub = new AssessmentHubPage(page);
    await hub.goto();
    await hub.expectSixPillarsVisible();
  });

  test("advisor rejects submitted intake", async ({ page }) => {
    test.setTimeout(300_000);

    await new SignInPage(page).signInAs("clientFresh");
    await completeIntakeViaTypeTab(page, { fromLanding: true });

    await page.context().clearCookies();
    await new SignInPage(page).signInAs("advisor");

    await page.goto("/advisor/pipeline");
    const clientLink = page
      .getByRole("link")
      .filter({ hasText: USERS.clientFresh.email })
      .first();
    await clientLink.waitFor({ timeout: 30_000 });
    await page.goto((await clientLink.getAttribute("href"))!);

    const reviewLink = page
      .locator('a[href^="/advisor/review/"]')
      .filter({ hasText: /Review (Responses|Intake)/i })
      .first();
    await reviewLink.click();
    await page.waitForURL(/\/advisor\/review\/[^/]+$/, { timeout: 30_000 });

    const review = new AdvisorIntakeReviewPage(page);
    await review.expectInReviewState();
    await review.rejectWithConfirmation();

    await page.context().clearCookies();
    await new SignInPage(page).signInAs("clientFresh");

    await page.goto("/assessment");
    await page.waitForURL(/\/dashboard(\?|$)/, { timeout: 30_000 });
    expect(new URL(page.url()).searchParams.get("assessment")).toBe(
      "complete-intake"
    );
  });
});
