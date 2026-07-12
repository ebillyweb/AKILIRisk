import { test, expect } from "@playwright/test";

import { SignInPage } from "../page-objects/SignInPage";
import {
  expectMarketingHeaderAuthenticated,
  expectMarketingHeaderSignedOut,
  signOutFromHeader,
} from "../helpers/sign-out-header";

test.describe("sign-out header refresh", () => {
  test(
    "marketing header shows public nav after sign-out on the homepage",
    { tag: "@smoke" },
    async ({ page }) => {
      await new SignInPage(page).signInAs("advisor");
      await page.goto("/");

      await expectMarketingHeaderAuthenticated(page);

      await signOutFromHeader(page);
      await page.waitForURL(/\/$/, { timeout: 30_000 });

      await expectMarketingHeaderSignedOut(page);
    },
  );

  test(
    "advisor workspace header sign-out ends the session",
    { tag: "@smoke" },
    async ({ page }) => {
      await new SignInPage(page).signInAs("advisor");
      await page.goto("/advisor");

      await expect(
        page.getByRole("button", { name: /^sign out$/i }),
      ).toBeVisible();

      await signOutFromHeader(page);
      await page.waitForURL(/\/signin/, { timeout: 30_000 });

      await expect(page.locator("#email")).toBeVisible();
      await expect(page.getByRole("link", { name: /go to dashboard/i })).toBeHidden();
    },
  );
});
