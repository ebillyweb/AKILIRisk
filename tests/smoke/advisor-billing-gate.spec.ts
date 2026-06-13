import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";
import { USERS } from "../fixtures/users";

/**
 * `(protected)/advisor/layout.tsx` calls `getAdvisorHubAccessForUserId` and
 * redirects an ADVISOR with `blockReason === "subscription"` to
 * `/advisor/billing` (anywhere except /advisor/billing itself). advisor3 is
 * seeded with no Subscription row, so they're the natural fixture for this.
 */
test.describe("advisor billing gate", () => {
  test("advisor without an active subscription is sent to /advisor/billing", async ({ page }) => {
    await page.goto("/signin");
    await page.locator("#email").fill(USERS.advisor3.email);
    await page.locator("#password").fill(USERS.advisor3.password);
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await page.waitForURL(/\/advisor\/billing(\?|$)/, { timeout: 30_000 });
    expect(new URL(page.url()).pathname).toBe("/advisor/billing");
    expect(new URL(page.url()).searchParams.get("notice")).toBe(
      "subscription_required",
    );

    await expect(page.getByRole("heading", { name: /^Billing$/ })).toBeVisible();
  });

  test("/advisor, /advisor/pipeline, and /advisor/dashboard all redirect the no-sub advisor to billing", async ({ page }) => {
    await new SignInPage(page).signInAs("advisor3");

    for (const path of ["/advisor", "/advisor/pipeline", "/advisor/dashboard"]) {
      await page.goto(path);
      await page.waitForURL(/\/advisor\/billing(\?|$)/, { timeout: 15_000 });
      expect(new URL(page.url()).pathname).toBe("/advisor/billing");
    }
  });
});
