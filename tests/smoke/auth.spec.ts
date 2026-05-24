import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";
import { USERS, type Role } from "../fixtures/users";

interface DashboardAssertion {
  role: Role;
  expectedUrlPath: string;
  heading: RegExp;
  secondarySignal: RegExp;
}

const DASHBOARDS: DashboardAssertion[] = [
  {
    role: "advisor",
    expectedUrlPath: "/advisor",
    heading: /Overview/i,
    secondarySignal: /Pipeline snapshot/i,
  },
  {
    role: "client",
    expectedUrlPath: "/dashboard",
    heading: /Dashboard/i,
    secondarySignal: /Your Assessments/i,
  },
  {
    role: "admin",
    expectedUrlPath: "/admin",
    heading: /System Administration/i,
    secondarySignal: /Advisors/i,
  },
];

for (const { role, expectedUrlPath, heading, secondarySignal } of DASHBOARDS) {
  test.describe(`${role} smoke`, () => {
    test(`${role} can sign in and load their dashboard`, async ({ page }) => {
      const user = USERS[role];
      const signIn = new SignInPage(page);

      await signIn.goto();
      await signIn.signIn(user.email, user.password);

      await page.waitForURL(new RegExp(`${expectedUrlPath}(/|$|\\?)`), {
        timeout: 30_000,
      });
      expect(new URL(page.url()).pathname).toBe(expectedUrlPath);

      await expect(page.getByText(heading).first()).toBeVisible();
      await expect(page.getByText(secondarySignal).first()).toBeVisible();
    });
  });
}
