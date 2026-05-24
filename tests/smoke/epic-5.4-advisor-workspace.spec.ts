import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";
import { USERS } from "../fixtures/users";

test.describe("Epic 5.4 — advisor workspace", () => {
  test("US-28: pipeline search filters to assigned client", async ({ page }) => {
    test.setTimeout(60_000);

    await new SignInPage(page).signInAs("advisor");
    await page.goto("/advisor/pipeline");

    await page.getByPlaceholder(/search by name or email/i).fill(USERS.client.email);
    await expect(
      page.getByRole("link").filter({ hasText: USERS.client.email }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("US-28: pipeline stalled filter toggle is available", async ({ page }) => {
    await new SignInPage(page).signInAs("advisor");
    await page.goto("/advisor/pipeline?stalled=1");

    await expect(page.getByRole("button", { name: /stalled/i })).toBeVisible();
    await expect(page.getByText(/stalled only/i)).toBeVisible();
  });

  test("US-34: advisor cannot open another advisor's intelligence detail", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    await new SignInPage(page).signInAs("advisor");
    await page.goto("/advisor/pipeline");
    const clientLink = page
      .getByRole("link")
      .filter({ hasText: USERS.client.email })
      .first();
    await expect(clientLink).toBeVisible({ timeout: 30_000 });
    const clientId = (await clientLink.getAttribute("href"))!.split("/").pop()!;

    await page.context().clearCookies();
    await new SignInPage(page).signInAs("advisor2");

    await page.goto(`/advisor/intelligence/${clientId}`);
    await expect(
      page.getByText(/no risk data available|not assigned|error loading/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("US-35: notification preferences page loads", async ({ page }) => {
    await new SignInPage(page).signInAs("advisor");
    await page.goto("/advisor/settings/notifications");

    await expect(
      page.getByRole("heading", { name: /notification preferences/i }),
    ).toBeVisible();
    await expect(page.getByText(/quiet hours \(your local time\)/i)).toBeVisible();
    await expect(page.getByRole("textbox", { name: /^start$/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /^end$/i })).toBeVisible();
  });
});
