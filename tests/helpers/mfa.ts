import { TOTP } from "@otplib/totp";
import { NobleCryptoPlugin } from "@otplib/plugin-crypto-noble";
import { ScureBase32Plugin } from "@otplib/plugin-base32-scure";
import type { APIRequestContext, Page } from "@playwright/test";

import { USERS } from "../fixtures/users";
import { TEST_AUTH_SKIP_REASON } from "./test-auth";

const totp = new TOTP({
  crypto: new NobleCryptoPlugin(),
  base32: new ScureBase32Plugin(),
  issuer: "Akili Risk",
  digits: 6,
  period: 30,
  algorithm: "sha1",
});

export interface MfaFixture {
  email: string;
  secret: string;
  recoveryCodes: string[];
}

/** Advisor used for MFA smokes — avoids leaving MFA enabled on advisor@test.com. */
export const MFA_ADVISOR = USERS.advisor2;

export async function generateTotpCode(secret: string): Promise<string> {
  return totp.generate({ secret });
}

async function postMfaPrepare(
  request: APIRequestContext,
  email: string,
  resetOnly: boolean
): Promise<Response> {
  return request.post("/api/test/mfa/prepare", {
    data: { email, resetOnly },
  });
}

/**
 * Enable MFA on an advisor/admin test user via /api/test/mfa/prepare.
 */
export async function prepareMfaFixture(
  request: APIRequestContext,
  email: string = MFA_ADVISOR.email
): Promise<MfaFixture> {
  const res = await postMfaPrepare(request, email, false);
  if (res.status() === 404) {
    throw new Error(TEST_AUTH_SKIP_REASON);
  }
  if (!res.ok()) {
    throw new Error(
      `MFA prepare failed: ${res.status()} ${await res.text()}`
    );
  }
  return (await res.json()) as MfaFixture;
}

/** Disable MFA after smokes so other advisor sign-in tests stay green. */
export async function resetMfaFixture(
  request: APIRequestContext,
  email: string = MFA_ADVISOR.email
): Promise<void> {
  const res = await postMfaPrepare(request, email, true);
  if (res.status() === 404) {
    return;
  }
  if (!res.ok()) {
    throw new Error(`MFA reset failed: ${res.status()} ${await res.text()}`);
  }
}

/** Credentials sign-in until the MFA challenge screen (US-48). */
export async function signInUntilMfaChallenge(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/signin");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/mfa\/verify/, { timeout: 30_000 });
}

export async function completeMfaWithTotp(
  page: Page,
  secret: string
): Promise<void> {
  const code = await generateTotpCode(secret);
  await page.locator("#token").fill(code);
  await page.getByRole("button", { name: /^verify$/i }).click();
}

export async function completeMfaWithRecoveryCode(
  page: Page,
  recoveryCode: string
): Promise<void> {
  await page.getByRole("button", { name: /recovery code/i }).click();
  await page.locator("#recovery").fill(recoveryCode);
  await page.getByRole("button", { name: /verify recovery code/i }).click();
}

export async function signOutToSignIn(page: Page): Promise<void> {
  await page.goto(
    `/api/auth/signout?callbackUrl=${encodeURIComponent("/signin")}`
  );
  await page.getByRole("button", { name: /^sign out$/i }).click();
  await page.waitForURL(/\/signin/, { timeout: 30_000 });
}
