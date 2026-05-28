import { expect, type Page } from "@playwright/test";
import { USERS, type Role } from "../fixtures/users";
import { restoreClientConsent } from "../helpers/consent-prepare";

/**
 * Round-11 session-2: client roles authenticate via magic link, not
 * credentials (commit 219c52e blocks role=USER from the credentials
 * provider). signInAs branches on role; client roles go through the
 * test-only /api/test/magic-link/issue endpoint, then navigate the
 * returned verify URL — exercising the real magic-link flow.
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

  async goto() {
    await this.page.goto("/signin");
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
    await this.goto();
    await this.signIn(user.email, user.password);
    await this.page.waitForURL(
      new RegExp(`${user.expectedLandingPath}(/|$|\\?)`),
      { timeout: 30_000 }
    );
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
