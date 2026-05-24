import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";
import { AssessmentHubPage } from "../page-objects/AssessmentHubPage";
import { AssessmentQuestionPage } from "../page-objects/AssessmentQuestionPage";
import { skipUnlessTestAuth } from "../helpers/test-auth";
import { resetAssessmentProgress } from "../helpers/assessment";
import { USERS } from "../fixtures/users";

/**
 * Epic 5.2 — US-13 maturity-scale UI on pillar questions.
 */
test.describe("Epic 5.2 — maturity scale UI (US-13)", () => {
  test.beforeEach(async ({ request }) => {
    await skipUnlessTestAuth(request);
    await resetAssessmentProgress(request, USERS.client.email);
  });

  test("governance question shows four maturity levels and saves selection", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await new SignInPage(page).signInAs("client");

    const hub = new AssessmentHubPage(page);
    await hub.goto();
    await hub.openPillar("governance");

    const question = new AssessmentQuestionPage(page);
    await question.expectMaturityScaleVisible();
    await question.selectMaturity(2);
    await question.expectMaturitySelected(2);

    await expect(
      page.getByRole("button", { name: /^continue$/i })
    ).toBeEnabled();
    await question.continueToNext();

    await expect(page).toHaveURL(/\/assessment\/governance\/1/);
  });
});

/**
 * Epic 5.2 — US-14 save and resume across sign-in (server-authoritative position).
 */
test.describe("Epic 5.2 — assessment resume session (US-14)", () => {
  test.beforeEach(async ({ request }) => {
    await skipUnlessTestAuth(request);
    await resetAssessmentProgress(request, USERS.client.email);
  });

  test("client resumes at saved pillar question after sign-out and sign-in", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await new SignInPage(page).signInAs("client");

    const hub = new AssessmentHubPage(page);
    await hub.goto();
    await hub.openPillar("governance");

    const question = new AssessmentQuestionPage(page);
    await question.selectMaturity(2);
    await question.continueToNext();

    await expect(page).toHaveURL(/\/assessment\/governance\/1/);
    await question.selectMaturity(0);

    await page.context().clearCookies();
    await new SignInPage(page).signInAs("client");

    await hub.goto();
    await hub.openPillar("governance");

    await expect(page).toHaveURL(/\/assessment\/governance\/1/);
    await question.expectMaturitySelected(0);
  });

  test("server position wins over stale localStorage on hub reload", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await new SignInPage(page).signInAs("client");

    const hub = new AssessmentHubPage(page);
    await hub.goto();
    await hub.openPillar("governance");

    const question = new AssessmentQuestionPage(page);
    await question.selectMaturity(1);
    await question.continueToNext();
    await question.selectMaturity(3);
    await question.waitForAnswerSaved();

    await page.evaluate(() => {
      const raw = localStorage.getItem("belvedere-assessment");
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        state?: { currentQuestionIndex?: number };
      };
      if (parsed.state) {
        parsed.state.currentQuestionIndex = 0;
        localStorage.setItem("belvedere-assessment", JSON.stringify(parsed));
      }
    });

    await page.goto("/assessment");
    await expect(page.getByTestId("assessment-pillar-grid")).toBeVisible({
      timeout: 45_000,
    });
    await hub.openPillar("governance");

    await expect(page).toHaveURL(/\/assessment\/governance\/1/);
    await question.expectMaturitySelected(3);
  });
});
