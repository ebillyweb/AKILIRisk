import { test, expect } from "@playwright/test";

import { SignInPage } from "../page-objects/SignInPage";
import {
  expectMarketingHeaderAuthenticated,
  expectMarketingHeaderSignedOut,
  signOutFromHeader,
} from "../helpers/sign-out-header";
import { HERO_AUDIENCE_LANDING_PATHS } from "@/lib/marketing/friendly-urls";

// The homepage canonicalizes to an audience-friendly path (/ -> /families for
// the default "families" audience), and header sign-out returns to the current
// path (performClientSignOut({ pathname })). So a sign-out from "/" can land on
// "/" or any audience landing path — accept all of them for the post-sign-out
// URL wait; the real assertion is the signed-out header below.
const MARKETING_HOME_PATHS = new Set<string>([
  "/",
  ...HERO_AUDIENCE_LANDING_PATHS,
]);

test.describe("sign-out header refresh", () => {
  test(
    "marketing header shows public nav after sign-out on the homepage",
    { tag: "@smoke" },
    async ({ page }) => {
      await new SignInPage(page).signInAs("advisor");
      await page.goto("/");

      await expectMarketingHeaderAuthenticated(page);

      await signOutFromHeader(page);
      await page.waitForURL(
        (url) => MARKETING_HOME_PATHS.has(url.pathname),
        { timeout: 30_000 },
      );

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
