import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";
import { USERS } from "../fixtures/users";

/**
 * Advisor opens the client detail and clicks "Review Intake" -> /advisor/review/[id]
 * The review page renders the client's name, email, submitted date, the
 * transcripts of each intake response, and an approval status badge.
 *
 * Uses client@test.com (seeded SUBMITTED + Approved intake assigned to
 * advisor@test.com).
 */
test.describe("advisor reviews intake", () => {
  test("advisor can navigate from pipeline to /advisor/review/[id] and see transcripts", async ({ page }) => {
    test.setTimeout(90_000);

    await new SignInPage(page).signInAs("advisor");

    await page.goto("/advisor/pipeline");
    const clientLink = page
      .getByRole("link")
      .filter({ hasText: USERS.client.email })
      .first();
    await clientLink.waitFor({ timeout: 15_000 });
    const clientHref = await clientLink.getAttribute("href");
    await page.goto(clientHref!);

    // Wait for Suspense to settle - email shown in detail body confirms the
    // ClientDetailContent server component finished fetching.
    await page
      .getByText(USERS.client.email)
      .first()
      .waitFor({ timeout: 30_000 });

    const reviewLink = page
      .locator('a[href^="/advisor/review/"]')
      .filter({ hasText: /Review (Responses|Intake)/i })
      .first();
    await expect(reviewLink).toBeVisible();
    const reviewHref = await reviewLink.getAttribute("href");
    expect(reviewHref).toMatch(/^\/advisor\/review\/[^/]+$/);

    await reviewLink.click();
    await page.waitForURL(/\/advisor\/review\/[^/]+$/, { timeout: 30_000 });

    // Confirm the server component finished (avoid flaking on heading text alone:
    // layout adds an sr-only h1, and hosted builds can hydrate slowly).
    await expect(page.getByText(USERS.client.email).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/Test Client/).first()).toBeVisible();

    await expect(
      page
        .getByRole("heading", { name: /^View intake$/ })
        .or(page.getByText(/^View intake$/))
        .first()
    ).toBeVisible({ timeout: 15_000 });

    // Question text from the seeded intake script (first INTAKE pillar question).
    await expect(
      page.getByText(/How did your financial advisor describe what we do at Test Advisory Firm/i)
    ).toBeVisible();

    // Review is read-only: question prompts are shown as text; Play question
    // lives on the live intake wizard, not on this page.
    await expect(
      page.getByRole("button", { name: /play question/i }),
    ).toHaveCount(0);
    await expect(page.getByText(/client response/i).first()).toBeVisible();
  });

  test("advisor cannot view another advisor's intake review via direct URL", async ({ page }) => {
    test.setTimeout(90_000);

    // Capture the seeded advisor1 review URL through the advisor1 flow.
    await new SignInPage(page).signInAs("advisor");
    await page.goto("/advisor/pipeline");
    const clientLink = page
      .getByRole("link")
      .filter({ hasText: USERS.client.email })
      .first();
    await clientLink.waitFor({ timeout: 15_000 });
    const clientHref = await clientLink.getAttribute("href");
    await page.goto(clientHref!);
    await page
      .getByText(USERS.client.email)
      .first()
      .waitFor({ timeout: 30_000 });
    const reviewHref = await page
      .locator('a[href^="/advisor/review/"]')
      .first()
      .getAttribute("href");
    expect(reviewHref).toMatch(/^\/advisor\/review\/[^/]+$/);

    // Switch to advisor2 (no shared assignments), navigate to advisor1's URL.
    await page.context().clearCookies();
    await new SignInPage(page).signInAs("advisor2");
    const response = await page.goto(reviewHref!);
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: /^404$/ })
    ).toBeVisible();
    await expect(page.getByText(USERS.client.email)).not.toBeVisible();
  });
});
