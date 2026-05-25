import { test, expect } from "@playwright/test";

import {
  MFA_ADVISOR,
  completeMfaWithRecoveryCode,
  completeMfaWithTotp,
  prepareMfaFixture,
  resetMfaFixture,
  signInUntilMfaChallenge,
  signOutToSignIn,
} from "../helpers/mfa";
import { skipUnlessTestAuth } from "../helpers/test-auth";

/**
 * Epic 5.6 / US-48 — advisor MFA sign-in and recovery codes.
 *
 * Requires ENABLE_TEST_AUTH=1 on the target deployment (prepare endpoint).
 * Uses advisor2@test.com so advisor@test.com smokes stay MFA-free.
 */
test.describe("Epic 5.6 — MFA sign-in (US-48)", () => {
  test.beforeEach(async ({ request }) => {
    await skipUnlessTestAuth(request);
    await resetMfaFixture(request, MFA_ADVISOR.email);
  });

  test.afterEach(async ({ request }) => {
    await resetMfaFixture(request, MFA_ADVISOR.email);
  });

  test("credentials sign-in stops at MFA verify until TOTP is entered", async ({
    page,
    request,
  }) => {
    const fixture = await prepareMfaFixture(request, MFA_ADVISOR.email);

    await signInUntilMfaChallenge(
      page,
      MFA_ADVISOR.email,
      MFA_ADVISOR.password
    );

    await expect(page.getByText(/verify your identity/i)).toBeVisible();

    const blocked = await page.request.get("/api/advisor/branding");
    expect(blocked.status()).toBe(403);
    expect(await blocked.json()).toMatchObject({
      error: "MFA verification required",
    });

    await page.goto("/documents");
    await page.waitForURL(/\/mfa\/verify/, { timeout: 15_000 });

    await completeMfaWithTotp(page, fixture.secret);
    await page.waitForURL(/\/documents/, { timeout: 30_000 });

    const allowed = await page.request.get("/api/advisor/branding");
    expect(allowed.status()).not.toBe(403);
  });

  test("recovery code completes sign-in and cannot be reused", async ({
    page,
    request,
  }) => {
    const fixture = await prepareMfaFixture(request, MFA_ADVISOR.email);
    const [firstCode] = fixture.recoveryCodes;
    expect(firstCode).toBeTruthy();

    await signInUntilMfaChallenge(
      page,
      MFA_ADVISOR.email,
      MFA_ADVISOR.password
    );

    await completeMfaWithRecoveryCode(page, firstCode);
    await page.waitForURL(
      new RegExp(`${MFA_ADVISOR.expectedLandingPath}(/|$|\\?)`),
      { timeout: 30_000 }
    );

    await signOutToSignIn(page);

    await signInUntilMfaChallenge(
      page,
      MFA_ADVISOR.email,
      MFA_ADVISOR.password
    );

    await completeMfaWithRecoveryCode(page, firstCode);
    await expect(
      page.getByText(/invalid or already used recovery code/i)
    ).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/mfa/verify");
  });
});
