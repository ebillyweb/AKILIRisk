import { test, expect } from "@playwright/test";
import { skipUnlessTestAuth } from "../helpers/test-auth";
import { restoreClientConsent } from "../helpers/consent-prepare";
import {
  issueTestInvitation,
  uniqueInvitationEmail,
  invitationPathFromUrl,
} from "../helpers/invitations";

/**
 * Invited clients on the platform host (preview / www) have no tenant headers.
 * Branding must resolve from ClientAdvisorAssignment (or invite fallback).
 */
test.describe("invited client portal branding", () => {
  test.beforeEach(async ({ request }) => {
    await skipUnlessTestAuth(request);
  });

  async function expectBrandedClientShell(page: import("@playwright/test").Page) {
    await expect(
      page.getByText(/Brought to you by AKILI Risk Intelligence/i)
    ).toBeVisible({ timeout: 15_000 });

    const advisorLogo = page.locator('img[src*="/api/client/advisor-logo"]');
    await expect(advisorLogo.first()).toBeVisible();

    const advisorPrimary = await page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue("--advisor-primary").trim()
    );
    expect(advisorPrimary.length, "--advisor-primary CSS var is set").toBeGreaterThan(0);
  }

  test("invited client sees advisor branding on intake after signup", async ({
    page,
    request,
  }) => {
    const email = uniqueInvitationEmail("branding-intake");
    const { url } = await issueTestInvitation(request, {
      clientEmail: email,
      clientName: "Branded Invite Client",
    });

    expect(url).toMatch(/\/signup\?/);

    await page.goto(invitationPathFromUrl(url));

    await page.waitForURL(/\/(consent\/pending|intake)(\/|$|\?)/, {
      timeout: 45_000,
    });

    if (page.url().includes("/consent/pending")) {
      await restoreClientConsent(request, email);
      await page.goto("/intake");
    }

    await page.waitForURL(/\/intake(\/|$|\?)/, { timeout: 30_000 });
    await expectBrandedClientShell(page);

    await page.goto("/intake/interview");
    await page.waitForURL(/\/intake\/interview/, { timeout: 30_000 });
    await expectBrandedClientShell(page);
    await expect(page.getByRole("heading", { name: /Family Governance Intake/i })).toBeVisible();
  });

  test("intake-waived invite shows branding on assessment", async ({
    page,
    request,
  }) => {
    const email = uniqueInvitationEmail("branding-assessment");
    const { url } = await issueTestInvitation(request, {
      clientEmail: email,
      intakeWaived: true,
    });

    await page.goto(invitationPathFromUrl(url));
    await page.waitForURL(/\/(consent\/pending|assessment)(\/|$|\?)/, {
      timeout: 45_000,
    });

    if (page.url().includes("/consent/pending")) {
      await restoreClientConsent(request, email);
      await page.goto("/assessment");
    }

    await page.waitForURL(/\/assessment(\/|$|\?)/, { timeout: 30_000 });
    await expectBrandedClientShell(page);
    await expect(page.getByRole("heading", { name: /Governance Assessment/i })).toBeVisible();
  });
});
