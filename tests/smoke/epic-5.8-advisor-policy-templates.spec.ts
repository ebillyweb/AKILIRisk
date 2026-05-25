import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";
import { skipUnlessTestAuth } from "../helpers/test-auth";
import { prepareCompletedAssessment } from "../helpers/assessment";
import { USERS } from "../fixtures/users";

/**
 * Epic 5.8 — US-62 / US-63 advisor per-pillar policy documents (Word + PDF).
 */
test.describe("Epic 5.8 — advisor policy templates (US-62, US-63)", () => {
  test.beforeEach(async ({ request }) => {
    await skipUnlessTestAuth(request);
  });

  test("assigned advisor downloads Word and PDF from pipeline UI and API", async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);

    const prepared = await prepareCompletedAssessment(request, {
      clientEmail: USERS.client.email,
      reset: true,
    });
    expect(prepared.pillarsScored.length).toBeGreaterThan(0);

    await new SignInPage(page).signInAs("advisor");

    await page.goto(`/advisor/pipeline/${prepared.clientId}`);
    await expect(page.getByRole("heading", { name: "Policy documents" })).toBeVisible({
      timeout: 45_000,
    });

    await expect(
      page.getByRole("button", { name: /word \(\.docx\)/i }).first()
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /^pdf$/i }).first()).toBeVisible();

    const docxApi = await page.request.get(
      `/api/templates/${prepared.assessmentId}?template=governance&format=docx`
    );
    expect(docxApi.ok()).toBeTruthy();
    expect(docxApi.headers()["content-type"]).toMatch(/wordprocessingml/i);
    expect((await docxApi.body()).byteLength).toBeGreaterThan(100);

    const pdfApi = await page.request.get(
      `/api/templates/${prepared.assessmentId}?template=governance&format=pdf`
    );
    expect(pdfApi.ok()).toBeTruthy();
    expect(pdfApi.headers()["content-type"]).toMatch(/pdf/i);
    const pdfBytes = await pdfApi.body();
    expect(pdfBytes.byteLength).toBeGreaterThan(500);
    expect(Buffer.from(pdfBytes).subarray(0, 4).toString()).toBe("%PDF");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /^pdf$/i }).first().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  });

  test("unassigned advisor receives 404 for client assessment templates", async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);

    const prepared = await prepareCompletedAssessment(request, {
      clientEmail: USERS.client.email,
      reset: true,
    });

    await new SignInPage(page).signInAs("advisor2");

    const res = await page.request.get(
      `/api/templates/${prepared.assessmentId}?template=governance&format=pdf`
    );
    expect(res.status()).toBe(404);
  });
});
