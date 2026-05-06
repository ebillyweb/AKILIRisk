/**
 * Round-11 commit 3 (BRD §5.1.AUTH): client (role=USER) accounts in this
 * fixture map still carry a `password` for legacy compatibility with
 * Playwright smokes that haven't been migrated to the magic-link flow.
 * Those smokes WILL FAIL post-round-11 because:
 *   - the credentials provider rejects role=USER (auth.config.ts)
 *   - the seed scripts now write password=null for client rows
 *
 * Migration path for the Playwright suite: replace credentials sign-in
 * with a magic-link issuance helper that POSTs to /api/auth/magic-link/
 * request, reads the token from the test mail inbox, and follows the
 * verify URL. Tracked separately from this commit.
 */
export type Role =
  | "advisor"
  | "advisor2"
  | "advisor3"
  | "advisor4"
  | "advisorUnbranded"
  | "client"
  | "clientUnbranded"
  | "clientMfa"
  | "admin"
  | "clientFresh";

export interface TestUser {
  role: Role;
  email: string;
  password: string;
  expectedLandingPath: string;
}

const env = (key: string, fallback: string) => process.env[key]?.trim() || fallback;

export const USERS: Record<Role, TestUser> = {
  advisor: {
    role: "advisor",
    email: env("ADVISOR_EMAIL", "advisor@test.com"),
    password: env("ADVISOR_PASSWORD", "testpassword123"),
    expectedLandingPath: "/advisor",
  },
  /**
   * Independent advisor with their own AdvisorProfile and no client
   * assignments. Used by cross-advisor isolation tests to verify direct-URL
   * access to another advisor's client returns 404.
   */
  advisor2: {
    role: "advisor2",
    email: env("ADVISOR2_EMAIL", "advisor2@test.com"),
    password: env("ADVISOR2_PASSWORD", "testpassword123"),
    expectedLandingPath: "/advisor",
  },
  /**
   * Advisor with no Subscription row - the (protected)/advisor/layout.tsx
   * billing gate redirects them to /advisor/billing on every advisor route.
   */
  advisor3: {
    role: "advisor3",
    email: env("ADVISOR3_EMAIL", "advisor3@test.com"),
    password: env("ADVISOR3_PASSWORD", "testpassword123"),
    expectedLandingPath: "/advisor/billing",
  },
  /**
   * Advisor whose subdomain is `disabled-tenant.akilirisk.com`
   * (`isActive=false, dnsVerified=true`). Subdomain-routing tests do NOT
   * sign in as advisor4 today (they only navigate to the host); the
   * fixture exists for future tests that need to authenticate as the
   * deactivated-subdomain owner.
   */
  advisor4: {
    role: "advisor4",
    email: env("ADVISOR4_EMAIL", "advisor4@test.com"),
    password: env("ADVISOR4_PASSWORD", "testpassword123"),
    expectedLandingPath: "/advisor",
  },
  /**
   * Advisor with `brandingEnabled=false` on their AdvisorProfile. Their
   * assigned client (`clientUnbranded`) sees the default Akili lockup. The
   * default-branding-fallback test signs in as the client; future tests
   * that exercise the advisor-side branding-disabled UI can sign in here.
   */
  advisorUnbranded: {
    role: "advisorUnbranded",
    email: env("ADVISOR_UNBRANDED_EMAIL", "advisor-unbranded@test.com"),
    password: env("ADVISOR_UNBRANDED_PASSWORD", "testpassword123"),
    expectedLandingPath: "/advisor",
  },
  /**
   * Client assigned to an advisor with brandingEnabled=false. Their dashboard
   * shows the default Akili branding instead of an advisor's white-label.
   */
  clientUnbranded: {
    role: "clientUnbranded",
    email: env("CLIENT_UNBRANDED_EMAIL", "client-unbranded@test.com"),
    password: env("CLIENT_UNBRANDED_PASSWORD", "testpassword123"),
    expectedLandingPath: "/dashboard",
  },
  client: {
    role: "client",
    email: env("CLIENT_EMAIL", "client@test.com"),
    password: env("CLIENT_PASSWORD", "testpassword123"),
    expectedLandingPath: "/dashboard",
  },
  /**
   * Client account seeded for MFA enrollment / challenge tests. MFA is
   * NOT enabled at seed time — tests that exercise the verify flow enable
   * it via Settings before signing out and back in. Lands on /dashboard
   * when MFA is off; lands on /mfa/verify when MFA is on and unverified.
   */
  clientMfa: {
    role: "clientMfa",
    email: env("CLIENT_MFA_EMAIL", "client-mfa@test.com"),
    password: env("CLIENT_MFA_PASSWORD", "testpassword123"),
    expectedLandingPath: "/dashboard",
  },
  admin: {
    role: "admin",
    email: env("ADMIN_EMAIL", "buddy@ebilly.com"),
    password: env("ADMIN_PASSWORD", "Test1111!"),
    expectedLandingPath: "/admin",
  },
  /**
   * Client with no intake interview row - reset to NOT_STARTED before each
   * intake test via `scripts/reset-fresh-client-intake.js`. Lands on /dashboard
   * showing the "Not started" hero label.
   */
  clientFresh: {
    role: "clientFresh",
    email: env("CLIENT_FRESH_EMAIL", "client-fresh@test.com"),
    password: env("CLIENT_FRESH_PASSWORD", "testpassword123"),
    expectedLandingPath: "/dashboard",
  },
};
