import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";

/**
 * Per-advisor white-label: when a client is assigned to an advisor with
 * brandingEnabled, the client portal shows the advisor's branding instead of
 * the platform default.
 *
 * Resolution path: (protected)/layout.tsx -> getAssignedAdvisorBrandingForClient
 * -> BrandingProvider applies the advisor's firmName, colors, and logo.
 *
 * client@test.com is assigned to advisor@test.com (firmName edited to
 * "AKILI Risk Management" via the admin UI on staging). The exact name
 * could change, so this test verifies the branding signals (kicker, logo
 * route, CSS var) rather than a specific firm name.
 */
test.describe("client portal branding", () => {
  test("branded client sees advisor branding signals on /dashboard", async ({ page }) => {
    await new SignInPage(page).signInAs("client");

    const brandedKicker = page.getByText(
      /Brought to you by AKILI Risk Intelligence/i
    );
    await expect(brandedKicker).toBeVisible();

    const advisorLogo = page.locator('img[src*="/api/client/advisor-logo"]');
    await expect(advisorLogo.first()).toBeVisible();

    const logoResponse = await page.request.get("/api/client/advisor-logo");
    expect(logoResponse.status(), "advisor logo endpoint responds").toBe(200);

    const advisorPrimary = await page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue("--advisor-primary").trim()
    );
    expect(advisorPrimary.length, "--advisor-primary CSS var is set").toBeGreaterThan(0);

    await expect(page.getByTestId("dashboard-journey")).toBeVisible();
    await expect(page.getByText("Your journey")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Explore your portal/i }),
    ).not.toBeVisible();
    await expect(page.getByTestId("client-portal-footer")).toBeVisible();
    await expect(page.getByText(/Powered by AkiliRisk Platform/i)).toBeVisible();
    await expect(page.getByTestId("dashboard-footer")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Open assessment hub/i }),
    ).toBeVisible();
  });
});
