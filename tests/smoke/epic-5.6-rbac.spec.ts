import { test, expect } from "@playwright/test";

import { SignInPage } from "../page-objects/SignInPage";
import {
  completeSignOutIfPrompted,
  deactivateTestUser,
  DEACTIVATE_TEST_ADVISOR,
  restoreTestUser,
} from "../helpers/user-deactivate";
import { skipUnlessTestAuth } from "../helpers/test-auth";

/**
 * Epic 5.6 / US-49 — system RBAC and soft-deleted account handling.
 */
test.describe("Epic 5.6 — RBAC (US-49)", () => {
  test.describe("soft-deleted account", () => {
    test.beforeEach(async ({ request }) => {
      await skipUnlessTestAuth(request);
      await restoreTestUser(request, DEACTIVATE_TEST_ADVISOR.email);
    });

    test.afterEach(async ({ request }) => {
      await restoreTestUser(request, DEACTIVATE_TEST_ADVISOR.email);
    });

    test("active session is ended after soft-delete and sign-in is blocked", async ({
      page,
      request,
    }) => {
      const signIn = new SignInPage(page);
      await signIn.goto();
      await signIn.signIn(
        DEACTIVATE_TEST_ADVISOR.email,
        DEACTIVATE_TEST_ADVISOR.password
      );
      await page.waitForURL(/\/advisor/, { timeout: 30_000 });

      await deactivateTestUser(request, DEACTIVATE_TEST_ADVISOR.email);

      await page.goto("/advisor");
      await completeSignOutIfPrompted(page);

      await page.waitForURL(/\/signin/, { timeout: 30_000 });
      const url = new URL(page.url());
      expect(url.pathname).toBe("/signin");
      expect(url.searchParams.get("notice")).toBe("account_deactivated");
      await expect(
        page.getByText(/account has been deactivated/i)
      ).toBeVisible();

      await signIn.signIn(
        DEACTIVATE_TEST_ADVISOR.email,
        DEACTIVATE_TEST_ADVISOR.password
      );
      await expect(
        page.getByText(/invalid email or password/i)
      ).toBeVisible();
      expect(new URL(page.url()).pathname).toBe("/signin");
    });
  });
});
