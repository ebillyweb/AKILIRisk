import { test, expect } from "@playwright/test";

import type { EnterpriseScenarioSnapshot } from "@/lib/test/enterprise-e2e";
import { SignInPage } from "../page-objects/SignInPage";
import { USERS } from "../fixtures/users";
import { skipUnlessTestAuth } from "../helpers/test-auth";
import {
  setupEnterpriseScenario,
  teardownEnterpriseScenario,
} from "../helpers/enterprise-prepare";

/**
 * Firm-level "Shared client visibility" toggle smoke.
 *
 * Feature: enterprise OWNER/ADMIN can flip a firm-wide "Shared client
 * visibility" switch on /advisor/settings/access-control. When ON,
 * `resolvePortfolioScope` returns firm scope for ADVISOR members so they
 * see every firm client instead of only their own assignments. The value
 * persists as `advisorMemberSharedClientVisibilityEnabled` on the
 * AdvisorEnterprise row (default false).
 *
 * Scaffolding used: setupEnterpriseScenario provisions an enterprise with
 * advisor2 as OWNER (ACTIVE) and advisor4 as an ADVISOR member. We sign in
 * as the owner and drive the settings form directly.
 *
 * NOTE — why this is the MINIMUM path (settings persistence) and not the
 * IDEAL path (member portfolio visibility):
 *   The prepared scenario does NOT assign a client to the owner, and the
 *   inspect helper (EnterpriseScenarioInspect) exposes no "clients visible
 *   to member" projection or portfolio-scope read. There is no clean way to
 *   read the member's visible client set from the existing scaffolding, so
 *   verifying the backend `resolvePortfolioScope` effect would require
 *   fabricating a client fixture + a new read endpoint. Per the task
 *   constraints we do not fabricate fixtures; the backend scope behavior is
 *   covered by unit tests elsewhere. This spec asserts the owner-facing
 *   control renders, toggles, and persists.
 *
 * Requires ENABLE_TEST_AUTH=1.
 */

const SHARED_VISIBILITY_CHECKBOX = "#advisor-visibility-sharedClientVisibility";
const SAVE_BUTTON_NAME = /Save Roles & Permissions settings/i;

test.describe("enterprise shared client visibility toggle", () => {
  let scenario: EnterpriseScenarioSnapshot;

  test.beforeEach(async ({ request }) => {
    await skipUnlessTestAuth(request);
    scenario = await setupEnterpriseScenario(request, {
      ownerEmail: USERS.advisor2.email,
      memberEmail: USERS.advisor4.email,
    });
  });

  test.afterEach(async ({ request }) => {
    if (!scenario?.enterpriseId) return;
    await teardownEnterpriseScenario(request, {
      enterpriseId: scenario.enterpriseId,
      slug: scenario.slug,
      actorEmail: USERS.admin.email,
    });
  });

  test("owner can toggle and persist shared client visibility", async ({ page }) => {
    await new SignInPage(page).signInAs("advisor2");

    async function gotoAccessControl() {
      await page.goto("/advisor/settings/access-control");
      await expect(page.locator(SHARED_VISIBILITY_CHECKBOX)).toBeVisible();
    }

    async function saveAndReload() {
      const saveButton = page.getByRole("button", { name: SAVE_BUTTON_NAME });
      await expect(saveButton).toBeEnabled();
      await saveButton.click();
      // Server action persists then router.refresh() fires; wait for the
      // success toast before reloading so we read the committed value.
      await expect(page.getByText(/Team settings saved\./i)).toBeVisible();
      await gotoAccessControl();
    }

    await gotoAccessControl();

    const checkbox = page.locator(SHARED_VISIBILITY_CHECKBOX);
    // Firm default is OFF.
    await expect(checkbox).not.toBeChecked();

    // Toggle ON, save, reload -> persisted checked.
    await checkbox.click();
    await expect(checkbox).toBeChecked();
    await saveAndReload();
    await expect(page.locator(SHARED_VISIBILITY_CHECKBOX)).toBeChecked();

    // Restore: toggle OFF, save, reload -> back to default unchecked.
    const checkboxAfterReload = page.locator(SHARED_VISIBILITY_CHECKBOX);
    await checkboxAfterReload.click();
    await expect(checkboxAfterReload).not.toBeChecked();
    await saveAndReload();
    await expect(page.locator(SHARED_VISIBILITY_CHECKBOX)).not.toBeChecked();
  });
});
