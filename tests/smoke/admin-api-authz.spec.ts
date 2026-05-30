import { test, expect, type APIRequestContext } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";
import type { Page } from "@playwright/test";

/**
 * Admin API surface — authorization posture + happy paths.
 *
 * The codebase has two different "deny" postures across admin endpoints:
 *   1. Existence-leak 404 — used by /api/admin/exports, /api/admin/control-center,
 *      /api/admin/audit-log/export. These call `getAuditAdminActorOrNull()`
 *      and return 404 when there's no admin actor.
 *   2. Unhandled throw -> 500 — used by /api/admin/reports/export and
 *      /api/admin/advisors/[userId]/logo. These call `requireAdminRole()`
 *      inside a try-block whose catch returns 500 for every error including
 *      auth failures.
 *
 * The 500 cases are tracked in tests/INVENTORY.md "Surfaced bugs" and locked
 * in here via test.fixme() so the suite goes green once posture (1) is the
 * uniform default.
 */

async function cookieHeader(page: Page) {
  const cookies = await page.context().cookies();
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

async function getAs(
  request: APIRequestContext,
  page: Page | null,
  path: string
) {
  if (!page) {
    return request.get(path);
  }
  const cookie = await cookieHeader(page);
  return request.get(path, { headers: { cookie } });
}

test.describe("admin API authorization", () => {
  // ─────────────────────────────────────────────────────────────
  // Existence-leak 404 (the desired posture)
  // ─────────────────────────────────────────────────────────────
  for (const path of [
    "/api/admin/audit-log/export",
    "/api/admin/exports?scope=system",
    "/api/admin/control-center",
  ]) {
    test(`unauthenticated GET ${path} returns 404`, async ({ request }) => {
      const r = await getAs(request, null, path);
      expect(r.status()).toBe(404);
    });
  }

  test("non-admin advisor gets 404 from /api/admin/control-center", async ({
    page,
    request,
  }) => {
    await new SignInPage(page).signInAs("advisor2");
    const r = await getAs(request, page, "/api/admin/control-center");
    expect(r.status()).toBe(404);
  });

  test("client gets 404 from /api/admin/audit-log/export", async ({
    page,
    request,
  }) => {
    await new SignInPage(page).signInAs("client");
    const r = await getAs(request, page, "/api/admin/audit-log/export");
    expect(r.status()).toBe(404);
  });

  // ─────────────────────────────────────────────────────────────
  // Authenticated admin happy paths
  // ─────────────────────────────────────────────────────────────
  test("admin gets a CSV from /api/admin/audit-log/export", async ({
    page,
    request,
  }) => {
    await new SignInPage(page).signInAs("admin");
    const r = await getAs(request, page, "/api/admin/audit-log/export");
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toMatch(/text\/csv/);
    expect((await r.body()).length).toBeGreaterThan(0);
  });

  test("admin gets JSON from /api/admin/control-center", async ({
    page,
    request,
  }) => {
    await new SignInPage(page).signInAs("admin");
    const r = await getAs(request, page, "/api/admin/control-center");
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toMatch(/application\/json/);
    const body = await r.json();
    expect(typeof body).toBe("object");
  });

  test("admin gets a ZIP from /api/admin/exports?scope=system", async ({
    page,
    request,
  }) => {
    await new SignInPage(page).signInAs("admin");
    const r = await getAs(request, page, "/api/admin/exports?scope=system");
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toMatch(/application\/zip/);
    const body = await r.body();
    expect(body.subarray(0, 4).toString("hex")).toBe("504b0304");
  });

  // ─────────────────────────────────────────────────────────────
  // Surfaced bugs — locked in via fixme. See tests/INVENTORY.md.
  // ─────────────────────────────────────────────────────────────
  test.fixme(
    "unauthenticated GET /api/admin/reports/export returns 404 (not 500)",
    async ({ request }) => {
      const r = await getAs(request, null, "/api/admin/reports/export");
      expect(r.status()).toBe(404);
    }
  );

  test.fixme(
    "non-admin GET /api/admin/reports/export returns 404 (not 500)",
    async ({ page, request }) => {
      await new SignInPage(page).signInAs("advisor2");
      const r = await getAs(request, page, "/api/admin/reports/export");
      expect(r.status()).toBe(404);
    }
  );

  test.fixme(
    "unauthenticated GET /api/admin/advisors/[userId]/logo returns 404 (not 500)",
    async ({ request }) => {
      const r = await getAs(
        request,
        null,
        "/api/admin/advisors/cmp7bp0vr0001slg89drf26da/logo"
      );
      expect(r.status()).toBe(404);
    }
  );

  test.fixme(
    "non-advisor authenticated GET /api/advisor/branding returns 401 (not 500)",
    async ({ page, request }) => {
      await new SignInPage(page).signInAs("client");
      const r = await getAs(request, page, "/api/advisor/branding");
      expect(r.status()).toBe(401);
    }
  );
});
