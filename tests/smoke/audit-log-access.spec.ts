import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";

/**
 * Auth gate for /admin/audit-log. ADMIN sees the page; ADVISOR / USER /
 * unauthenticated all get the same 404 (existence-leak avoidance, same
 * posture as the audio-streaming route).
 *
 * The CSV export route /api/admin/audit-log/export is gated identically.
 */

test.describe("admin audit-log access control", () => {
  test("admin can view /admin/audit-log", async ({ page }) => {
    await new SignInPage(page).signInAs("admin");
    const resp = await page.goto("/admin/audit-log");
    expect(resp?.status(), "admin should not get 404").not.toBe(404);
    await expect(
      page.getByRole("heading", { name: /^audit log \(\d/i })
    ).toBeVisible();
    // Verify the meta-audit hook fires by checking the table contains its
    // own data_access.audit_log_view rows after a few seconds. The fire-and-
    // forget write is fast enough that a reload reliably sees the prior row.
    await page.reload();
    await expect(
      page
        .locator('[data-testid="audit-log-row"][data-action="data_access.audit_log_view"]')
        .first()
    ).toBeVisible();
  });

  test("advisor gets 404 on /admin/audit-log", async ({ page }) => {
    await new SignInPage(page).signInAs("advisor");
    const resp = await page.goto("/admin/audit-log");
    // Next.js notFound() returns 404 status from the response.
    expect(resp?.status()).toBe(404);
  });

  test("client gets 404 on /admin/audit-log", async ({ page }) => {
    await new SignInPage(page).signInAs("client");
    const resp = await page.goto("/admin/audit-log");
    expect(resp?.status()).toBe(404);
  });

  test("unauthenticated request to /admin/audit-log redirects or 404s", async ({ page }) => {
    // No sign-in. Either the (protected) layout redirects to /signin OR
    // notFound() returns 404 — both are acceptable existence-leak postures.
    // What's NOT acceptable is a 200 with the table.
    const resp = await page.goto("/admin/audit-log");
    expect(resp?.status()).not.toBe(200);
    await expect(
      page.locator('[data-testid="audit-log-table"]')
    ).toHaveCount(0);
  });

  test("non-admin gets 404 on /api/admin/audit-log/export", async ({ request }) => {
    // Unauthenticated request to the export route must 404, never expose
    // CSV bytes.
    const resp = await request.get("/api/admin/audit-log/export");
    expect(resp.status()).toBe(404);
  });
});
