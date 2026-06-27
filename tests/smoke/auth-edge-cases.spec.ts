import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";
import { USERS } from "../fixtures/users";

test.describe("auth edge cases", () => {
  test("wrong password shows the credential error and stays on /signin", async ({ page }) => {
    // Round-11 session-2: this test originally drove the credentials
    // form with a CLIENT email + wrong password. Post-219c52e the
    // credentials provider rejects role=USER unconditionally, so the
    // failure message would still appear but for a different reason
    // (client_role_blocked, not invalid_password). Reframe to use the
    // ADVISOR path — the "wrong password" failure shape is a real
    // invariant on the advisor flow, which is the only one that still
    // exercises credentials.
    await page.goto("/signin?role=advisor");
    await page.locator("#email").fill(USERS.advisor.email);
    await page.locator("#password").fill("not-the-real-password");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await expect(
      page.getByText(/Invalid email or password/i)
    ).toBeVisible();
    await expect(
      page.getByText(/email sign-in link/i)
    ).toBeVisible();

    expect(new URL(page.url()).pathname).toBe("/signin");
  });

  test("unauthenticated user hitting /dashboard is sent to magic-link sign-in with callbackUrl", async ({ page }) => {
    await page.goto("/dashboard");
    const url = new URL(page.url());
    expect(url.pathname).toBe("/signin");
    expect(url.searchParams.get("role")).toBe("client");
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
    // dashboard page's role-router. The unauthorized notice that surfaces in
    // the UI is verified by the next test ("advisor sees an unauthorized
    // notice…"); this case only asserts the security redirect itself.
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
