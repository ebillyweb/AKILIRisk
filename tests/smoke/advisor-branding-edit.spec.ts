import { test, expect } from "@playwright/test";
import { LOGO_MAX_BYTES } from "@/lib/validation/branding";
import type { BrandingE2EBaseline } from "@/lib/test/branding-e2e";

import { SignInPage } from "../page-objects/SignInPage";
import { AdvisorBrandingSettingsPage } from "../page-objects/AdvisorBrandingSettingsPage";
import { USERS } from "../fixtures/users";
import { skipUnlessTestAuth } from "../helpers/test-auth";
import { prepareAdvisorBranding } from "../helpers/branding-prepare";
import {
  hexToHslComponents,
  normalizeHslForCompare,
  readAdvisorPrimaryHsl,
} from "../helpers/branding-colors";
import { restoreClientConsent } from "../helpers/consent-prepare";

const BRANDING_AUDIT_ACTION = "branding.update_branding";

/** Accessible preset from ColorPicker — distinct from default seed navy. */
const E2E_PRIMARY_HEX = "#533483";

async function expandLatestBrandingAuditRow(
  page: import("@playwright/test").Page,
  actorEmail: string
): Promise<string> {
  await page.goto(
    `/admin/audit-log?action=${encodeURIComponent(BRANDING_AUDIT_ACTION)}&actorUserId=${encodeURIComponent(actorEmail)}`
  );
  await expect(
    page.getByRole("heading", { name: /^audit log \(\d/i })
  ).toBeVisible({ timeout: 20_000 });

  const row = page
    .locator(`[data-testid="audit-log-row"][data-action="${BRANDING_AUDIT_ACTION}"]`)
    .first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await expect(row.getByText(actorEmail)).toBeVisible();

  await row.getByRole("button").first().click();
  return (await row.textContent()) ?? "";
}

/**
 * Advisor branding edit at /advisor/settings: save tagline + primary color,
 * verify client portal theming and AdvisorBrandingAuditLog shape, plus
 * negative validation (hex, logo size, invalid support email).
 *
 * Requires ENABLE_TEST_AUTH=1 for branding prepare + client magic-link sign-in.
 * Fixture: advisor@test.com → client@test.com (see scripts/seed-advisor-test-data.js).
 *
 * Note: Public brand name / firm name are read-only on this page (admin-managed).
 */
test.describe("advisor branding edit + audit log", () => {
  let baseline: BrandingE2EBaseline;

  test.beforeEach(async ({ request }) => {
    await skipUnlessTestAuth(request);
    const snap = await prepareAdvisorBranding(request, {
      advisorEmail: USERS.advisor.email,
      ensureBrandingEnabled: true,
    });
    baseline = snap.baseline;
  });

  test.afterEach(async ({ request }) => {
    await prepareAdvisorBranding(request, {
      advisorEmail: USERS.advisor.email,
      restore: baseline,
    });
  });

  test("save tagline and primary color → client portal + branding audit row", async ({
    page,
    browser,
  }) => {
    const runId = `${Date.now().toString(36)}`;
    const newTagline = `E2E branding tagline ${runId}`;
    const previousTagline = baseline.tagline ?? "";

    const settings = new AdvisorBrandingSettingsPage(page);
    await new SignInPage(page).signInAs("advisor");
    await settings.goto();

    await settings.openTab("identity");
    await expect(page.locator("#brandNameDisplay")).toBeDisabled();

    await settings.taglineInput().fill(newTagline);
    await settings.openTab("colors");
    await settings.primaryColorInput().fill(E2E_PRIMARY_HEX);
    await settings.saveChanges();

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    try {
      await new SignInPage(adminPage).signInAs("admin");
      const auditText = await expandLatestBrandingAuditRow(
        adminPage,
        USERS.advisor.email
      );
      expect(auditText).toContain("tagline");
      expect(auditText).toContain(newTagline);
      if (previousTagline) {
        expect(auditText).toContain(previousTagline);
      }
      if (baseline.primaryColor) {
        expect(auditText).toContain(baseline.primaryColor);
      }
      expect(auditText).toContain(E2E_PRIMARY_HEX);
    } finally {
      await adminContext.close();
    }

    const clientContext = await browser.newContext();
    const clientPage = await clientContext.newPage();
    try {
      await restoreClientConsent(clientPage.request, USERS.client.email);
      await new SignInPage(clientPage).signInAs("client");

      await expect(
        clientPage.getByText(/Brought to you by AKILI Risk Intelligence/i)
      ).toBeVisible();

      const expectedHsl = hexToHslComponents(E2E_PRIMARY_HEX);
      expect(expectedHsl).not.toBeNull();
      const applied = await readAdvisorPrimaryHsl(clientPage);
      expect(applied).not.toBeNull();
      expect(normalizeHslForCompare(applied!)).toBe(
        normalizeHslForCompare(expectedHsl!)
      );
    } finally {
      await clientContext.close();
    }
  });

  test("invalid primary hex shows validation hint and keeps save disabled", async ({
    page,
  }) => {
    await new SignInPage(page).signInAs("advisor");
    const settings = new AdvisorBrandingSettingsPage(page);
    await settings.goto();
    await settings.openTab("colors");

    await settings.primaryColorInput().fill("not-a-hex");
    await expect(
      page.getByText(/enter a valid hex color/i)
    ).toBeVisible();
    await expect(settings.saveButton()).toBeDisabled();
  });

  test("primary color failing accessibility shows validation on save", async ({
    page,
  }) => {
    await new SignInPage(page).signInAs("advisor");
    const settings = new AdvisorBrandingSettingsPage(page);
    await settings.goto();
    await settings.openTab("colors");

    await settings.primaryColorInput().fill("#808080");
    await expect(
      page.getByText(/may not meet accessibility requirements/i)
    ).toBeVisible();
    await settings.saveButton().click();
    await expect(
      page.getByText(/fails accessibility requirements/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  test("oversized logo upload shows a client-side size error", async ({
    page,
  }) => {
    await new SignInPage(page).signInAs("advisor");
    const settings = new AdvisorBrandingSettingsPage(page);
    await settings.goto();

    await settings.uploadLogoFile(AdvisorBrandingSettingsPage.oversizedLogoFixture());

    const maxMb = LOGO_MAX_BYTES / (1024 * 1024);
    await expect(
      page.getByText(new RegExp(`exceeds maximum allowed size.*${maxMb}MB`, "i"))
    ).toBeVisible({ timeout: 15_000 });
  });

  test("invalid support email shows field error on save", async ({ page }) => {
    await new SignInPage(page).signInAs("advisor");
    const settings = new AdvisorBrandingSettingsPage(page);
    await settings.goto();
    await settings.openTab("support");

    await settings.supportEmailInput().fill("not-an-email");
    await expect(settings.saveButton()).toBeEnabled();
    await settings.saveButton().click();

    await expect(
      page.getByText(/invalid support email address/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  test("non-HTTPS website URL shows validation error on save", async ({ page }) => {
    await new SignInPage(page).signInAs("advisor");
    const settings = new AdvisorBrandingSettingsPage(page);
    await settings.goto();
    await settings.openTab("identity");

    await settings.websiteUrlInput().fill("http://insecure.example.com");
    await settings.saveButton().click();

    await expect(
      page.getByText(/website URL must use HTTPS/i)
    ).toBeVisible({ timeout: 10_000 });
  });
});
