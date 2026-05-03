import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";

test.describe("auth edge cases", () => {
  test("wrong password shows the credential error and stays on /signin", async ({ page }) => {
    await page.goto("/signin");
    await page.locator("#email").fill("client@test.com");
    await page.locator("#password").fill("not-the-real-password");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await expect(
      page.getByText(/Invalid email or password/i)
    ).toBeVisible();

    expect(new URL(page.url()).pathname).toBe("/signin");
  });

  test("unauthenticated user hitting /dashboard is sent to /signin with callbackUrl", async ({ page }) => {
    await page.goto("/dashboard");
    const url = new URL(page.url());
    expect(url.pathname).toBe("/signin");
    expect(url.searchParams.get("callbackUrl")).toBe("/dashboard");
  });

  test("client cannot reach /admin and lands on /dashboard?error=unauthorized", async ({ page }) => {
    await new SignInPage(page).signInAs("client");
    await page.goto("/admin");
    const url = new URL(page.url());
    expect(url.pathname).toBe("/dashboard");
    expect(url.searchParams.get("error")).toBe("unauthorized");
    await expect(
      page.getByText(/System Administration/i)
    ).not.toBeVisible();
  });

  test("client cannot reach /advisor and lands on /dashboard?error=unauthorized", async ({ page }) => {
    await new SignInPage(page).signInAs("client");
    await page.goto("/advisor");
    const url = new URL(page.url());
    expect(url.pathname).toBe("/dashboard");
    expect(url.searchParams.get("error")).toBe("unauthorized");
  });

  test("advisor cannot view admin content when navigating directly to /admin", async ({ page }) => {
    await new SignInPage(page).signInAs("advisor");
    await page.goto("/admin");

    // Advisor is bounced via /dashboard?error=unauthorized -> /advisor by the
    // dashboard page's role-router. Security is enforced; see "Surfaced bugs"
    // in tests/INVENTORY.md for the missing UX feedback.
    expect(new URL(page.url()).pathname).toBe("/advisor");
    await expect(
      page.getByRole("heading", { name: /System Administration/i })
    ).not.toBeVisible();
  });

  // Bug filed in tests/INVENTORY.md: advisor->/admin redirect chain swallows
  // the ?error=unauthorized query param via /dashboard -> /advisor, so the
  // advisor gets no signal that they tried to access something they can't.
  // Even for the client case, no UI surfaces the param. Lock-in once fixed.
  test.fixme(
    "advisor sees an unauthorized notice after attempting /admin",
    async ({ page }) => {
      await new SignInPage(page).signInAs("advisor");
      await page.goto("/admin");
      await expect(
        page.getByText(/unauthorized|don.t have access|access denied/i)
      ).toBeVisible();
    }
  );
});
