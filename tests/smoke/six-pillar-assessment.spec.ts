import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";
import { SignInPage } from "../page-objects/SignInPage";
import {
  AssessmentHubPage,
} from "../page-objects/AssessmentHubPage";
import { skipUnlessTestAuth } from "../helpers/test-auth";
import {
  issueTestInvitation,
  uniqueInvitationEmail,
  invitationPathFromUrl,
} from "../helpers/invitations";
import { restoreClientConsent } from "../helpers/consent-prepare";

/**
 * US-12 / US-14 smoke — six-pillar assessment hub and pillar entry.
 *
 * Requires ENABLE_TEST_AUTH=1 for client magic-link sign-in (see SignInPage).
 * Seeded `client@test.com` must have advisor-approved intake on the target env.
 */
test.describe("Six-pillar assessment hub (US-12)", () => {
  test.beforeEach(async ({ request }) => {
    await skipUnlessTestAuth(request);
  });

  test("approved client sees all six pillar cards", async ({ page }) => {
    await new SignInPage(page).signInAs("client");

    const hub = new AssessmentHubPage(page);
    await hub.goto();
    await hub.expectSixPillarsVisible();

    await expect(page.getByRole("heading", { name: "Household risk domains" })).toBeVisible();
  });

  test("client can open governance pillar and reach the questionnaire", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await new SignInPage(page).signInAs("client");

    const hub = new AssessmentHubPage(page);
    await hub.goto();
    await hub.openPillar("governance");

    await expect(page).toHaveURL(/\/assessment\/governance\/\d+/);
    await expect(page.getByRole("button", { name: /^next$/i })).toBeVisible({
      timeout: 45_000,
    });
    await expect(page.getByText("Question", { exact: true })).toBeVisible({
      timeout: 45_000,
    });
    await expect(page.getByText(/\d+\s+\/\s+\d+/)).toBeVisible();
  });

  test("client can open governance and cyber pillars from the hub", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await new SignInPage(page).signInAs("client");

    const hub = new AssessmentHubPage(page);
    await hub.goto();

    for (const slug of ["governance", "cyber-digital"] as const) {
      await hub.openPillar(slug);
      await expect(page.getByRole("button", { name: /^next$/i })).toBeVisible({
        timeout: 45_000,
      });
      await hub.goto();
    }
  });
});

test.describe("Assessment access gate", () => {
  test.beforeEach(async ({ request }) => {
    await skipUnlessTestAuth(request);
    execSync("node scripts/reset-fresh-client-intake.js", {
      stdio: "inherit",
      cwd: process.cwd(),
      env: process.env,
    });
  });

  test("client without approved intake cannot open /assessment", async ({ page }) => {
    await new SignInPage(page).signInAs("clientFresh");

    await page.goto("/assessment");
    await page.waitForURL(/\/dashboard(\?|$)/, { timeout: 30_000 });
    expect(new URL(page.url()).pathname).toBe("/dashboard");
    expect(new URL(page.url()).searchParams.get("assessment")).toBe("complete-intake");
  });
});

test.describe("Intake-waived six-pillar hub", () => {
  test.beforeEach(async ({ request }) => {
    await skipUnlessTestAuth(request);
  });

  test("waived invitation redemption shows six pillar cards", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);

    const email = uniqueInvitationEmail("six-pillar-hub");
    const { url } = await issueTestInvitation(request, {
      clientEmail: email,
      intakeWaived: true,
    });

    await page.goto(invitationPathFromUrl(url));
    await page.waitForURL(/\/(assessment|consent\/pending)(\/|$|\?)/, {
      timeout: 45_000,
    });

    if (new URL(page.url()).pathname === "/consent/pending") {
      await restoreClientConsent(request, email);
      await page.goto("/assessment");
      await page.waitForURL(/\/assessment(\/|$|\?)/, { timeout: 30_000 });
    }

    const hub = new AssessmentHubPage(page);
    await hub.expectSixPillarsVisible();
  });
});
