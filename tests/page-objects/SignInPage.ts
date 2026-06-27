import { expect, type Page } from "@playwright/test";
import { USERS, type Role } from "../fixtures/users";
import { restoreClientConsent } from "../helpers/consent-prepare";
import {
  generateTotpCode,
  prepareMfaFixture,
} from "../helpers/mfa";

/**
 * Round-11 session-2: client roles authenticate via magic link, not
 * credentials (commit 219c52e blocks role=USER from the credentials
 * provider). signInAs branches on role; client roles go through the
 * test-only /api/test/magic-link/issue endpoint, then navigate the
 * returned verify URL — exercising the real magic-link flow.
 *
 * June 2026: a separate commit made MFA mandatory for the
 * advisor-hub roles. Credential sign-in now lands on /mfa/setup (no
 * MFA enrolled) or /mfa/verify (enrolled but un-verified for this
 * session). The non-client branch of signInAs primes the fixture via
 * /api/test/mfa/prepare so we always have a known TOTP secret, then
 * fills the 6-digit code on /mfa/verify when the post-credentials
 * redirect lands there.
 */
const CLIENT_ROLES = new Set<Role>([
  "client",
  "clientUnbranded",
  "clientMfa",
  "clientFresh",
]);

function isClientRole(role: Role): boolean {
  return CLIENT_ROLES.has(role);
}

export class SignInPage {
  constructor(private readonly page: Page) {}

  async goto(role: "advisor" | "admin" = "advisor") {
    await this.page.goto(`/signin?role=${role}`);
    await expect(this.page.locator("#email")).toBeVisible();
  }

  async signIn(email: string, password: string) {
    await this.page.locator("#email").fill(email);
    await this.page.locator("#password").fill(password);
    await this.page.getByRole("button", { name: /^sign in$/i }).click();
  }

  async signInAs(
    role: Role,
    options?: {
      /** Skip US-51 consent restore (only for consent-gate specs). */
      skipConsentPrepare?: boolean;
    }
  ) {
    const user = USERS[role];
    if (isClientRole(role)) {
      await this.signInViaMagicLink(user.email, user.expectedLandingPath, options);
      return;
    }
    await this.signInWithCredentialsAndMaybeMfa(
      user.email,
      user.password,
      user.expectedLandingPath
    );
  }

  /**
   * Credentials sign-in for advisor-hub roles. Post commit 560bde0 MFA is
   * opt-in for the platform, so the default flow does NOT enroll MFA on
   * the fixture — that previously caused redirect loops between the JWT
   * (no MFA claim) and the DB (mfaEnabled=true) after the prepare call
   * re-enrolled the user.
   *
   * If the post-credentials redirect lands on /mfa/verify (the user happens
   * to have MFA on — e.g. epic-5.6-mfa-sign-in.spec.ts left it enabled),
   * call /api/test/mfa/prepare to rotate to a known TOTP secret, then
   * submit the 6-digit code. We deliberately do NOT auto-handle
   * /mfa/setup: MFA is opt-in now, so a fixture landing there is a real
   * test-data drift signal worth surfacing.
   */
  private async signInWithCredentialsAndMaybeMfa(
    email: string,
    password: string,
    expectedLandingPath: string
  ) {
    await this.goto();
    await this.signIn(email, password);

    const landing = new RegExp(`${expectedLandingPath}(/|$|\\?)`);

    const matched = await this.page
      .waitForURL((url) => {
        const pathSearch = `${url.pathname}${url.search}`;
        if (landing.test(pathSearch)) return true;
        return /\/mfa\/(verify|setup)(\?|$)/.test(pathSearch);
      }, { timeout: 30_000 })
      .then(() => true)
      .catch(() => false);

    if (!matched) {
      throw new Error(
        `Credentials sign-in for ${email} did not reach landing or MFA: ${this.page.url()}`
      );
    }

    const path = new URL(this.page.url()).pathname;
    if (landing.test(`${path}/`)) return;

    if (path === "/mfa/setup") {
      throw new Error(
        `Credentials sign-in for ${email} landed on /mfa/setup — MFA enforcement is opt-in (commit 560bde0), so this fixture has MFA-required state that needs to be cleared via scripts/reset-user-mfa.js (or by re-running scripts/seed-advisor-test-data.js).`
      );
    }

    // /mfa/verify — rotate to a known secret + complete TOTP.
    const fixture = await prepareMfaFixture(this.page.request, email);
    const code = await generateTotpCode(fixture.secret);
    await this.page.locator("#token").fill(code);
    await this.page.getByRole("button", { name: /^verify$/i }).click();
    await this.page.waitForURL(landing, { timeout: 30_000 });
  }

  /**
   * Client sign-in via the test-only magic-link issuance endpoint.
   * Exercises the real issue → verify → signIn flow.
   *
   * Requires ENABLE_TEST_AUTH=1 on the target deployment (preview or local).
   * If the endpoint returns 404 the helper throws a clear error pointing at
   * the env-var setup so the failure mode is debuggable from CI logs.
   */
  private async signInViaMagicLink(
    email: string,
    expectedLandingPath: string,
    options?: { skipConsentPrepare?: boolean }
  ) {
    if (!options?.skipConsentPrepare) {
      await restoreClientConsent(this.page.request, email);
    }

    const issueRes = await this.page.request.post(
      "/api/test/magic-link/issue",
      { data: { email } }
    );

    if (issueRes.status() === 404) {
      throw new Error(
        "Test magic-link issuance endpoint returned 404. " +
          "Confirm ENABLE_TEST_AUTH=1 is set on the target deployment " +
          "(see .env.example). On Vercel Preview, redeploy after setting the var."
      );
    }
    if (!issueRes.ok()) {
      throw new Error(
        `Test magic-link issue failed: ${issueRes.status()} ${await issueRes.text()}`
      );
    }

    const { verifyUrl } = (await issueRes.json()) as {
      rawToken: string;
      verifyUrl: string;
      expires: string;
    };

    // The verify URL embedded in the issuance response uses NEXT_PUBLIC_URL
    // (or the localhost fallback); strip the origin so we navigate using
    // the Playwright baseURL. This prevents a mismatch between
    // NEXT_PUBLIC_URL on the deployment and PLAYWRIGHT_BASE_URL from
    // sending the page to the wrong host.
    const u = new URL(verifyUrl);
    await this.page.goto(u.pathname + u.search);
    await this.waitForClientLanding(email, expectedLandingPath);
  }

  /** Wait for post-login landing; recover if US-51 consent gate intercepts. */
  private async waitForClientLanding(
    email: string,
    expectedLandingPath: string
  ) {
    const landingPattern = new RegExp(`${expectedLandingPath}(/|$|\\?)`);
    try {
      await this.page.waitForURL(landingPattern, { timeout: 30_000 });
      return;
    } catch (err) {
      if (new URL(this.page.url()).pathname !== "/consent/pending") {
        throw err;
      }
    }

    await restoreClientConsent(this.page.request, email);
    await this.page.goto(expectedLandingPath);
    await this.page.waitForURL(landingPattern, { timeout: 30_000 });
  }
}
