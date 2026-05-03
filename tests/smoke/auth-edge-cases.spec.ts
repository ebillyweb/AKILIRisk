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

  test("advisor sees an unauthorized notice after attempting /admin", async ({ page }) => {
    await new SignInPage(page).signInAs("advisor");
    await page.goto("/admin");
    expect(new URL(page.url()).pathname).toBe("/advisor");
    expect(new URL(page.url()).searchParams.get("error")).toBe("unauthorized");
    await expect(
      page.getByRole("heading", { name: /access denied/i })
    ).toBeVisible();
    await expect(
      page.getByText(/don.t have permission to view that page/i)
    ).toBeVisible();
  });

  test("client sees an unauthorized notice after attempting /admin", async ({ page }) => {
    await new SignInPage(page).signInAs("client");
    await page.goto("/admin");
    expect(new URL(page.url()).searchParams.get("error")).toBe("unauthorized");
    await expect(
      page.getByRole("heading", { name: /access denied/i })
    ).toBeVisible();
  });
});
