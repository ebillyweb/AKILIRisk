import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";

/**
 * `getAssignedAdvisorBrandingForClient` returns null when the client's active
 * advisor has `brandingEnabled=false`. The protected layout then renders
 * `<AkiliLogoLockup />` and the platform-name kicker "AKILI Risk Intelligence"
 * instead of "Brought to you by AKILI Risk Intelligence".
 *
 * Fixture: client-unbranded@test.com -> advisor-unbranded@test.com
 * (brandingEnabled=false). See scripts/seed-advisor-test-data.js.
 */
test.describe("default Akili branding fallback", () => {
  test("client with brandingEnabled=false advisor sees the platform default", async ({ page }) => {
    await new SignInPage(page).signInAs("clientUnbranded");

    expect(new URL(page.url()).pathname).toBe("/dashboard");

    // Branded clients see "Brought to you by AKILI Risk Intelligence";
    // unbranded clients see the bare platform name as the kicker.
    await expect(
      page.getByText(/Brought to you by AKILI Risk Intelligence/i)
    ).not.toBeVisible();

    // The default `<AkiliLogoLockup />` renders an aria-labelled svg with
    // an "AKILI home" link wrapper; the branded client uses
    // `<ClientPortalBrandedHeaderMark />` instead (no "AKILI home" link).
    await expect(
      page.locator('[aria-label="AKILI home"]').first()
    ).toBeVisible();

    // Branded clients get a logo proxied via /api/client/advisor-logo.
    // Unbranded fallback should never render that <img>.
    const advisorLogoCount = await page
      .locator('img[src*="/api/client/advisor-logo"]')
      .count();
    expect(advisorLogoCount).toBe(0);
  });
});
