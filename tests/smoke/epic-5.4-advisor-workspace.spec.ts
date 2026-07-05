import { test, expect, type Page } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";
import { USERS } from "../fixtures/users";

function advisorWorkspaceNav(page: Page) {
  return page.getByRole("navigation", { name: "Advisor workspace" });
}

test.describe("Epic 5.4 — advisor workspace", () => {
  test.describe("Sidebar navigation", () => {
    test.beforeEach(async ({ page }) => {
      await new SignInPage(page).signInAs("advisor");
      await page.goto("/advisor");
      await expect(advisorWorkspaceNav(page)).toBeVisible();
    });

    test("Sessions opens the facilitate launcher from Home", async ({ page }) => {
      const nav = advisorWorkspaceNav(page);
      await nav.getByRole("link", { name: "Sessions" }).click();

      await expect(page).toHaveURL(/\/advisor\/facilitate\/?$/);
      await expect(
        page.getByRole("heading", { name: /^sessions$/i }),
      ).toBeVisible();
      await expect(nav.getByRole("link", { name: "Sessions" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    });

    test("Clients opens the pipeline", async ({ page }) => {
      const nav = advisorWorkspaceNav(page);
      await nav.getByRole("link", { name: "Clients" }).click();

      await expect(page).toHaveURL(/\/advisor\/pipeline\/?$/);
      await expect(nav.getByRole("link", { name: "Clients" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    });
  });

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
