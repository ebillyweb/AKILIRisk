import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";
import { type Role } from "../fixtures/users";

interface DashboardAssertion {
  role: Role;
  expectedUrlPath: string;
  heading: RegExp;
  secondarySignal: RegExp;
  /**
   * Include in the scheduled `@smoke` suite (see
   * .github/workflows/smoke-tests.yml, which runs on main but checks out this
   * branch). Only password-login roles are tagged: they have no external
   * dependency, so they stay green on preview without ENABLE_TEST_AUTH. The
   * client case exercises the magic-link flow, which requires
   * ENABLE_TEST_AUTH=1 on the target deployment, so it is left out of the
   * scheduled run (still covered by the full `npm run test:e2e` suite).
   */
  smoke: boolean;
}

const DASHBOARDS: DashboardAssertion[] = [
  {
    role: "advisor",
    expectedUrlPath: "/advisor",
    heading: /Overview/i,
    secondarySignal: /Pipeline snapshot/i,
    smoke: true,
  },
  {
    role: "client",
    expectedUrlPath: "/dashboard",
    heading: /Dashboard/i,
    secondarySignal: /Your journey/i,
    smoke: false,
  },
  {
    role: "admin",
    expectedUrlPath: "/admin",
    heading: /AKILI Control Center/i,
    secondarySignal: /Quick Access|Platform health/i,
    smoke: true,
  },
];

for (const {
  role,
  expectedUrlPath,
  heading,
  secondarySignal,
  smoke,
} of DASHBOARDS) {
  test.describe(`${role} smoke`, () => {
    test(
      `${role} can sign in and load their dashboard`,
      smoke ? { tag: "@smoke" } : {},
      async ({ page }) => {
        const signIn = new SignInPage(page);

        await signIn.signInAs(role);

        expect(new URL(page.url()).pathname).toBe(expectedUrlPath);

        await expect(page.getByText(heading).first()).toBeVisible();
        await expect(page.getByText(secondarySignal).first()).toBeVisible();
      }
    );
  });
}
