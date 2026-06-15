import { test, expect } from "@playwright/test";
import { skipUnlessTestAuth } from "../helpers/test-auth";
import { restoreClientConsent } from "../helpers/consent-prepare";
import {
  issueTestInvitation,
  uniqueInvitationEmail,
} from "../helpers/invitations";
import {
  expectBrandedClientPortalShell,
  expectBrandingUnavailableNotShown,
} from "../helpers/branded-portal-expectations";
import {
  ADVISOR2_TENANT_SLUG,
  expectOnTenantHost,
  expectTenantInvitationUrl,
} from "../helpers/tenant-host";

/**
 * KAN-1: Branded invite journey on advisor tenant hosts (`{slug}-staging.akilirisk.com`).
 *
 * Uses advisor2@test.com → `independent-wealth` (+ TENANT_SUBDOMAIN_SUFFIX).
 * Must navigate with the full invitation URL (not path-only) so Playwright hits the tenant host.
 *
 * @see docs/white-label-subdomains.md
 * @see tests/smoke/invited-client-portal-branding.spec.ts (platform-host path)
 */
test.describe("invited client portal branding on tenant host", () => {
  test.beforeEach(async ({ request }) => {
    await skipUnlessTestAuth(request);
  });

  test("tenant invite URL uses advisor subdomain", async ({ request }) => {
    const email = uniqueInvitationEmail("tenant-url");
    const { url } = await issueTestInvitation(request, {
      advisorEmail: "advisor2@test.com",
      clientEmail: email,
    });

    expectTenantInvitationUrl(url, ADVISOR2_TENANT_SLUG);
  });

  test("signup on tenant host shows advisor branding then intake", async ({
    page,
    request,
  }) => {
    const email = uniqueInvitationEmail("tenant-intake");
    const { url } = await issueTestInvitation(request, {
      advisorEmail: "advisor2@test.com",
      clientEmail: email,
      clientName: "Tenant Branded Client",
    });

    await page.goto(url);
    expectOnTenantHost(page.url());

    await expectBrandingUnavailableNotShown(page);
    await expect(page.getByText(/Independent Wealth Group/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText(/Brought to you by AKILI Risk Intelligence/i)
    ).toBeVisible();

    await page.waitForURL(/\/(consent\/pending|intake)(\/|$|\?)/, {
      timeout: 45_000,
    });
    expectOnTenantHost(page.url());

    if (page.url().includes("/consent/pending")) {
      await restoreClientConsent(request, email);
      await page.goto(new URL("/intake", url).toString());
    }

    await page.waitForURL(/\/intake(\/|$|\?)/, { timeout: 30_000 });
    expectOnTenantHost(page.url());
    await expectBrandingUnavailableNotShown(page);
    await expectBrandedClientPortalShell(page);
    await expect(page.getByRole("heading", { name: /Family Governance Intake/i })).toBeVisible();
  });

  test("intake-waived tenant invite shows branding on assessment", async ({
    page,
    request,
  }) => {
    const email = uniqueInvitationEmail("tenant-assessment");
    const { url } = await issueTestInvitation(request, {
      advisorEmail: "advisor2@test.com",
      clientEmail: email,
      intakeWaived: true,
    });

    await page.goto(url);
    expectOnTenantHost(page.url());

    await page.waitForURL(/\/(consent\/pending|assessment)(\/|$|\?)/, {
      timeout: 45_000,
    });
    expectOnTenantHost(page.url());

    if (page.url().includes("/consent/pending")) {
      await restoreClientConsent(request, email);
      await page.goto(new URL("/assessment", url).toString());
    }

    await page.waitForURL(/\/assessment(\/|$|\?)/, { timeout: 30_000 });
    expectOnTenantHost(page.url());
    await expectBrandingUnavailableNotShown(page);
    await expectBrandedClientPortalShell(page);
    await expect(page.getByRole("heading", { name: /Personal Risk Profile/i })).toBeVisible();
  });
});
