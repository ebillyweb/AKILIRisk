import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";
import { ClientDashboardPage } from "../page-objects/ClientDashboardPage";
import { skipUnlessTestAuth } from "../helpers/test-auth";
import { prepareCompletedAssessment, resetAssessmentProgress } from "../helpers/assessment";
import { USERS } from "../fixtures/users";

/**
 * Epic 5.2 — US-16 dashboard risk heat map after six-pillar scoring.
 */
test.describe("Epic 5.2 — dashboard heat map (US-16)", () => {
  test.beforeEach(async ({ request }) => {
    await skipUnlessTestAuth(request);
  });

  test("client dashboard shows populated six-cell heat map after scoring", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);

    const prepared = await prepareCompletedAssessment(request, {
      clientEmail: USERS.client.email,
      reset: true,
    });
    expect(prepared.status).toBe("COMPLETED");
    expect(prepared.pillarsScored.length).toBeGreaterThanOrEqual(6);

    await new SignInPage(page).signInAs("client");

    const dashboard = new ClientDashboardPage(page);
    await dashboard.goto();
    await dashboard.expectHeatMapPopulated();
    await dashboard.expectTopRisksVisible();
  });

  test("client dashboard shows empty heat map placeholder before scoring", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);

    await resetAssessmentProgress(request, USERS.client.email);

    await new SignInPage(page).signInAs("client");

    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: /risk by domain/i })
    ).toBeVisible({ timeout: 45_000 });

    const heatMap = page.getByTestId("risk-heat-map-single");
    await expect(heatMap).toBeVisible();
    await expect(
      heatMap.getByText(/No scored assessment yet/i)
    ).toBeVisible();
  });
});
