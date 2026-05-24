import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";
import { skipUnlessTestAuth } from "../helpers/test-auth";
import { prepareCompletedAssessment } from "../helpers/assessment";
import { USERS } from "../fixtures/users";

/**
 * Epic 5.2 — US-19 / US-20 advisor publish and client PDF download.
 */
test.describe("Epic 5.2 — report publish and client download (US-19, US-20)", () => {
  test.beforeEach(async ({ request }) => {
    await skipUnlessTestAuth(request);
  });

  test("client cannot download PDF before advisor publishes", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);

    const prepared = await prepareCompletedAssessment(request, {
      clientEmail: USERS.client.email,
      reset: true,
    });

    await new SignInPage(page).signInAs("client");

    const availability = await page.request.get(
      `/api/reports/${prepared.assessmentId}/availability`
    );
    expect(availability.ok()).toBeTruthy();
    const body = (await availability.json()) as { hasPublished: boolean };
    expect(body.hasPublished).toBe(false);

    const pdf = await page.request.get(
      `/api/reports/${prepared.assessmentId}/pdf`
    );
    expect(pdf.status()).toBe(404);
  });

  test("advisor publishes draft and client downloads published PDF", async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);

    const prepared = await prepareCompletedAssessment(request, {
      clientEmail: USERS.client.email,
      reset: true,
    });
    expect(prepared.status).toBe("COMPLETED");
    expect(prepared.draftReportId).toBeTruthy();

    await new SignInPage(page).signInAs("advisor");

    await page.goto(
      `/advisor/pipeline/${prepared.clientId}/report/edit`
    );
    await expect(
      page.getByRole("heading", { name: /editing draft/i })
    ).toBeVisible({ timeout: 45_000 });

    await page.getByRole("button", { name: /publish v\d+/i }).click();
    await page.waitForURL(
      new RegExp(`/advisor/pipeline/${prepared.clientId}/report`),
      { timeout: 45_000 }
    );
    await expect(page.getByText(/published/i).first()).toBeVisible({
      timeout: 30_000,
    });

    await page.context().clearCookies();
    await new SignInPage(page).signInAs("client");

    const availability = await page.request.get(
      `/api/reports/${prepared.assessmentId}/availability`
    );
    const availBody = (await availability.json()) as { hasPublished: boolean };
    expect(availBody.hasPublished).toBe(true);

    const pdf = await page.request.get(
      `/api/reports/${prepared.assessmentId}/pdf`
    );
    expect(pdf.ok()).toBeTruthy();
    expect(pdf.headers()["content-type"]).toMatch(/pdf/i);
    const bytes = await pdf.body();
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });
});
