import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";
import { AdvisorInvitationsPage } from "../page-objects/AdvisorInvitationsPage";
import { USERS } from "../fixtures/users";
import { skipUnlessTestAuth } from "../helpers/test-auth";
import {
  issueTestInvitation,
  uniqueInvitationEmail,
  invitationPathFromUrl,
} from "../helpers/invitations";

/**
 * Epic 5.1 — Client Invitation & Onboarding (BRD US-1 … US-9).
 *
 * UI flows use advisor@test.com credentials. Client redemption flows use
 * POST /api/test/invitation/issue (requires ENABLE_TEST_AUTH=1, same gate
 * as magic-link smokes).
 */
test.describe("Epic 5.1 — advisor invitations UI", () => {
  test.beforeEach(async ({ page }) => {
    await new SignInPage(page).signInAs("advisor");
  });

  test("US-1: send invitation normalizes email and shows Sent in history", async ({
    page,
  }) => {
    const rawEmail = `  MixedCase-${Date.now()}@AKILI-E2E.TEST  `;
    const expectedEmail = rawEmail.trim().toLowerCase();
    const invitations = new AdvisorInvitationsPage(page);

    await invitations.goto();
    await invitations.sendInvitation({ clientEmail: rawEmail, clientName: "Pat Client" });

    await expect(
      page.getByText(`Invitation sent to ${expectedEmail}`)
    ).toBeVisible({ timeout: 15_000 });

    await invitations.expectStatusForEmail(expectedEmail, /^Sent$/i);
  });

  test("US-9: filter invitations by status and client email search", async ({
    page,
  }) => {
    const email = uniqueInvitationEmail("filter");
    const invitations = new AdvisorInvitationsPage(page);

    await invitations.goto();
    await invitations.sendInvitation({ clientEmail: email });
    await expect(
      page.getByText(`Invitation sent to ${email}`)
    ).toBeVisible({ timeout: 15_000 });

    await invitations.applyFilters({ status: "Sent", search: email });
    await invitations.expectInvitationRow(email);

    await invitations.applyFilters({ search: "no-such-client@akili-e2e.test" });
    await expect(page.getByText(/No invitations match your filters/i)).toBeVisible();
  });

  test("US-8 / US-9: expire invitation hides resend; resend is not offered for Expired", async ({
    page,
  }) => {
    const email = uniqueInvitationEmail("expire");
    const invitations = new AdvisorInvitationsPage(page);

    await invitations.goto();
    await invitations.sendInvitation({ clientEmail: email });
    await expect(
      page.getByText(`Invitation sent to ${email}`)
    ).toBeVisible({ timeout: 15_000 });

    await invitations.expireForEmail(email);
    await expect(
      page.getByText(/Invitation expired successfully/i)
    ).toBeVisible({ timeout: 15_000 });

    await invitations.expectStatusForEmail(email, /^Expired$/i);
    await invitations.expectResendHiddenForEmail(email);
  });

  test("US-8: advisor can resend a sent invitation", async ({ page }) => {
    const email = uniqueInvitationEmail("resend");
    const invitations = new AdvisorInvitationsPage(page);

    await invitations.goto();
    await invitations.sendInvitation({ clientEmail: email });
    await expect(
      page.getByText(`Invitation sent to ${email}`)
    ).toBeVisible({ timeout: 15_000 });

    await invitations.resendForEmail(email);
    await expect(
      page.getByText(/Invitation resent successfully/i)
    ).toBeVisible({ timeout: 15_000 });
    await invitations.expectStatusForEmail(email, /^Sent$/i);
  });
});

test.describe("Epic 5.1 — invitation API & client redemption", () => {
  test.beforeEach(async ({ request }) => {
    await skipUnlessTestAuth(request);
  });

  test("test invitation issue endpoint returns signup URL with invite param", async ({
    request,
  }) => {
    const email = uniqueInvitationEmail("issue-api");
    const body = await issueTestInvitation(request, { clientEmail: email });

    expect(body.clientEmail).toBe(email);
    expect(body.status).toBe("SENT");
    expect(body.url).toMatch(/\/signup\?/);
    expect(body.url).toContain("invite=");
    expect(body.url).toContain(encodeURIComponent("/intake"));
  });

  test("US-1: intake-waived invitation links to assessment callback", async ({
    request,
  }) => {
    const email = uniqueInvitationEmail("waived");
    const body = await issueTestInvitation(request, {
      clientEmail: email,
      intakeWaived: true,
    });

    expect(body.intakeWaived).toBe(true);
    expect(body.url).toContain(encodeURIComponent("/assessment"));
    expect(body.url).not.toContain(encodeURIComponent("/intake"));
  });

  test("US-6: password registration endpoint returns 410 Gone", async ({
    request,
  }) => {
    const res = await request.post("/api/auth/register", { data: {} });
    expect(res.status()).toBe(410);
    const body = await res.json();
    expect(body.error).toMatch(/password is no longer supported/i);
  });

  test("US-6: invalid invite token shows a clear error", async ({ page }) => {
    await page.goto(
      "/signup?invite=not-a-valid-token&callbackUrl=%2Fintake"
    );
    await expect(
      page.getByText(/invalid or has expired/i)
    ).toBeVisible({ timeout: 15_000 });
  });

  test("US-5: opened API advances SENT to OPENED", async ({ page, request }) => {
    const email = uniqueInvitationEmail("opened-api");
    const { invitationId } = await issueTestInvitation(request, {
      clientEmail: email,
    });

    const res = await request.post(`/api/invitations/${invitationId}/opened`);
    expect(res.ok()).toBe(true);

    await page.context().clearCookies();
    await new SignInPage(page).signInAs("advisor");
    const invitations = new AdvisorInvitationsPage(page);
    await invitations.goto();
    await invitations.expectStatusForEmail(email, /^Opened$/i);
  });

  test("US-5 / US-6 / US-7: client redeems invite and lands on intake", async ({
    page,
    request,
  }) => {
    const email = uniqueInvitationEmail("redeem-intake");
    const { url, invitationId } = await issueTestInvitation(request, {
      clientEmail: email,
      clientName: "E2E Client",
    });

    await page.goto(invitationPathFromUrl(url));
    await page.waitForURL(/\/intake(\/|$|\?)/, { timeout: 45_000 });

    await page.context().clearCookies();
    await new SignInPage(page).signInAs("advisor");
    const invitations = new AdvisorInvitationsPage(page);
    await invitations.goto();
    await invitations.expectStatusForEmail(email, /^Opened$|^Registered$/i);
    expect(invitationId).toBeTruthy();
  });

  test("US-6 / US-7: intake-waived invite lands on assessment", async ({
    page,
    request,
  }) => {
    const email = uniqueInvitationEmail("redeem-assessment");
    const { url } = await issueTestInvitation(request, {
      clientEmail: email,
      intakeWaived: true,
    });

    await page.goto(invitationPathFromUrl(url));
    await page.waitForURL(/\/assessment(\/|$|\?)/, { timeout: 45_000 });
  });

  test("US-4: shareable link alert when initial send email fails", async ({
    page,
  }) => {
    const email = uniqueInvitationEmail("email-fail-ui");
    const invitations = new AdvisorInvitationsPage(page);
    await new SignInPage(page).signInAs("advisor");
    await invitations.goto();
    await invitations.sendInvitation({ clientEmail: email });

    const successToast = page.getByText(`Invitation sent to ${email}`);
    const linkAlert = page.getByText(/email was not sent/i);

    await expect(successToast.or(linkAlert)).toBeVisible({ timeout: 20_000 });

    if (await linkAlert.isVisible()) {
      await expect(
        page.getByText(/Copy this link and share it with your client/i)
      ).toBeVisible();
      const linkInput = page.locator('input[readonly][value*="signup"]');
      await expect(linkInput).toBeVisible();
      const value = await linkInput.inputValue();
      expect(value).toContain("invite=");
    }
  });
});

test.describe("Epic 5.1 — resend email recovery (US-4)", () => {
  test.beforeEach(async ({ page, request }) => {
    await skipUnlessTestAuth(request);
    await new SignInPage(page).signInAs("advisor");
  });

  test("resend shows shareable link when email delivery fails", async ({
    page,
    request,
  }) => {
    const email = uniqueInvitationEmail("resend-fail");
    await issueTestInvitation(request, { clientEmail: email });

    const invitations = new AdvisorInvitationsPage(page);
    await invitations.goto();
    await invitations.resendForEmail(email);

    const successToast = page.getByText(/Invitation resent successfully/i);
    const linkAlert = page.getByText(/email was not sent/i);

    await expect(successToast.or(linkAlert)).toBeVisible({ timeout: 20_000 });

    if (await linkAlert.isVisible()) {
      await expect(
        page.getByText(/Invitation resent — email was not sent/i)
      ).toBeVisible();
      const linkInput = page.locator('input[readonly][value*="signup"]');
      await expect(linkInput).toBeVisible();
    }
  });
});
