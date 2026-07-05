import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";
import { type Role } from "../fixtures/users";

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
    secondarySignal: /Your journey/i,
  },
  {
    role: "admin",
    expectedUrlPath: "/admin",
    heading: /AKILI Control Center/i,
    secondarySignal: /Quick Access|Platform health/i,
  },
];

for (const { role, expectedUrlPath, heading, secondarySignal } of DASHBOARDS) {
  test.describe(`${role} smoke`, () => {
    test(`${role} can sign in and load their dashboard`, async ({ page }) => {
      const signIn = new SignInPage(page);

      await signIn.signInAs(role);

      expect(new URL(page.url()).pathname).toBe(expectedUrlPath);

      await expect(page.getByText(heading).first()).toBeVisible();
      await expect(page.getByText(secondarySignal).first()).toBeVisible();
    });
  });
}
