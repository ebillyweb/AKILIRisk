import { test, expect } from "@playwright/test";

import type { EnterpriseScenarioSnapshot } from "@/lib/test/enterprise-e2e";
import { SignInPage } from "../page-objects/SignInPage";
import { AdvisorBrandingSettingsPage } from "../page-objects/AdvisorBrandingSettingsPage";
import { USERS } from "../fixtures/users";
import { skipUnlessTestAuth } from "../helpers/test-auth";
import {
  inspectEnterpriseScenario,
  setupEnterpriseScenario,
  teardownEnterpriseScenario,
} from "../helpers/enterprise-prepare";
import {
  issueTestInvitation,
  uniqueInvitationEmail,
  invitationPathFromUrl,
} from "../helpers/invitations";
import { restoreClientConsent } from "../helpers/consent-prepare";
import { readAdvisorPrimaryHsl, hexToHslComponents, normalizeHslForCompare } from "../helpers/branding-colors";

/**
 * Enterprise asset transfer + member sync smoke.
 *
 * Scenario:
 * 1. Solo owner (advisor2) gets custom branding, intake question, rec rule
 * 2. Admin provisions enterprise from owner assets
 * 3. Second advisor (advisor4) joins as ADVISOR
 * 4. Firm tables + member clones are verified
 * 5. Clients invited by each advisor see the same firm branding
 *
 * Fixtures: advisor2 (owner), advisor4 (member), admin (teardown actor).
 * Requires ENABLE_TEST_AUTH=1.
 */
test.describe("enterprise asset transfer and member sync", () => {
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

  test("owner custom assets transfer to the firm record", async ({ request }) => {
    const state = await inspectEnterpriseScenario(request, {
      enterpriseId: scenario.enterpriseId,
      memberEmail: USERS.advisor4.email,
    });

    expect(state.enterprise.tagline).toBe(scenario.marker.tagline);
    expect(state.enterprise.primaryColor).toBe(scenario.marker.primaryColor);
    expect(state.enterprise.intakeQuestionTexts).toContain(scenario.marker.intakeQuestionText);
    expect(state.enterprise.recommendationRuleNames).toContain(
      scenario.marker.recommendationRuleName,
    );
  });

  test("joining advisor receives firm methodology clones and resolved branding", async ({
    request,
  }) => {
    const state = await inspectEnterpriseScenario(request, {
      enterpriseId: scenario.enterpriseId,
      memberEmail: USERS.advisor4.email,
    });

    expect(state.member.enterpriseId).toBe(scenario.enterpriseId);
    expect(state.member.role).toBe("ADVISOR");
    expect(state.member.resolvedBranding?.tagline).toBe(scenario.marker.tagline);
    expect(state.member.resolvedBranding?.primaryColor).toBe(scenario.marker.primaryColor);
    expect(state.member.intakeQuestionTexts).toContain(scenario.marker.intakeQuestionText);
    expect(state.member.recommendationRuleNames).toContain(scenario.marker.recommendationRuleName);
  });

  test("enterprise advisor sees firm branding read-only in settings", async ({ page }) => {
    await new SignInPage(page).signInAs("advisor4");
    const settings = new AdvisorBrandingSettingsPage(page);
    await settings.goto();
    await settings.openTab("identity");

    await expect(page.getByText(/managed by your firm owner or administrators/i)).toBeVisible();
    await expect(page.locator("#brandNameDisplay")).toBeDisabled();
    await expect(page.locator("#advisor-firmName")).toBeDisabled();
    await expect(settings.taglineInput()).toHaveValue(scenario.marker.tagline);
    await expect(settings.taglineInput()).toBeDisabled();
    await expect(settings.saveButton()).toHaveCount(0);
  });

  test("enterprise advisor cannot override firm canonical branding", async ({
    page,
    request,
  }) => {
    await new SignInPage(page).signInAs("advisor4");
    const settings = new AdvisorBrandingSettingsPage(page);
    await settings.goto();
    await settings.openTab("identity");

    await expect(settings.taglineInput()).toBeDisabled();

    const state = await inspectEnterpriseScenario(request, {
      enterpriseId: scenario.enterpriseId,
      memberEmail: USERS.advisor4.email,
    });
    expect(state.enterprise.tagline).toBe(scenario.marker.tagline);
    expect(state.member.resolvedBranding?.tagline).toBe(scenario.marker.tagline);
  });

  test("clients of owner and member advisors see the same firm branding", async ({
    browser,
    request,
  }) => {
    async function expectFirmBrandingOnClient(clientPage: import("@playwright/test").Page) {
      await expect(
        clientPage.getByText(/Brought to you by AKILI Risk Intelligence/i),
      ).toBeVisible({ timeout: 15_000 });

      const expectedHsl = hexToHslComponents(scenario.marker.primaryColor);
      expect(expectedHsl).not.toBeNull();
      const applied = await readAdvisorPrimaryHsl(clientPage);
      expect(applied).not.toBeNull();
      expect(normalizeHslForCompare(applied!)).toBe(normalizeHslForCompare(expectedHsl!));
    }

    async function onboardInvitedClient(advisorRole: "advisor2" | "advisor4") {
      const email = uniqueInvitationEmail(`ent-${advisorRole}`);
      const advisorPage = await browser.newPage();
      try {
        await new SignInPage(advisorPage).signInAs(advisorRole);
        const inviteRes = await advisorPage.request.post("/api/test/invitation/issue", {
          data: { clientEmail: email, clientName: `Enterprise client ${advisorRole}` },
        });
        expect(inviteRes.ok(), await inviteRes.text()).toBeTruthy();
        const { url } = (await inviteRes.json()) as { url: string };

        const clientPage = await browser.newPage();
        await clientPage.goto(invitationPathFromUrl(url));
        await clientPage.waitForURL(/\/(consent\/pending|intake)(\/|$|\?)/, {
          timeout: 45_000,
        });
        if (clientPage.url().includes("/consent/pending")) {
          await restoreClientConsent(request, email);
          await clientPage.goto("/intake");
        }
        await clientPage.waitForURL(/\/intake(\/|$|\?)/, { timeout: 30_000 });
        await expectFirmBrandingOnClient(clientPage);
        await clientPage.close();
      } finally {
        await advisorPage.close();
      }
    }

    await onboardInvitedClient("advisor2");
    await onboardInvitedClient("advisor4");
  });
});
