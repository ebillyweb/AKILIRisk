export type Role =
  | "advisor"
  | "advisor2"
  | "advisor3"
  | "client"
  | "clientUnbranded"
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
