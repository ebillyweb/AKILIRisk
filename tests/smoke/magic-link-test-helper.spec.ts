import { test, expect } from "@playwright/test";
import { USERS } from "../fixtures/users";

/**
 * Round-11 session-2 meta-smoke: exercises the test-only magic-link
 * issuance endpoint + the verify-page consume flow end-to-end. If this
 * file fails, every other client-smoke fails for the same reason — so
 * keeping it as its own spec lets us localize debugging when CI breaks.
 *
 * Requires ENABLE_TEST_AUTH=1 + NODE_ENV !== "production" on the target
 * deployment (set on preview.akilirisk.com Vercel Preview env; set in
 * .env.local for local runs).
 */
test.describe("magic-link test helper", () => {
  test("POST /api/test/magic-link/issue returns rawToken + verifyUrl", async ({
    page,
  }) => {
    const res = await page.request.post("/api/test/magic-link/issue", {
      data: { email: USERS.client.email },
    });

    if (res.status() === 404) {
      throw new Error(
        "Test endpoint returned 404 — confirm ENABLE_TEST_AUTH=1 on the target deployment."
      );
    }
    expect(res.ok()).toBe(true);

    const body = await res.json();
    expect(typeof body.rawToken).toBe("string");
    expect(body.rawToken).toMatch(/^[0-9a-f]{64}$/);
    expect(typeof body.verifyUrl).toBe("string");
    expect(body.verifyUrl).toContain("/auth/magic-link/verify?token=");
    expect(typeof body.expires).toBe("string");
    // Expiry should be in the future (15-min default per the helper).
    expect(new Date(body.expires).getTime()).toBeGreaterThan(Date.now());
  });

  test("issue → verify URL → dashboard signs the client in", async ({ page }) => {
    const res = await page.request.post("/api/test/magic-link/issue", {
      data: { email: USERS.client.email },
    });
    expect(res.ok()).toBe(true);
    const { verifyUrl } = await res.json();

    // Strip origin so we use the Playwright baseURL (matches the
    // SignInPage helper's behavior — see notes there).
    const u = new URL(verifyUrl);
    await page.goto(u.pathname + u.search);

    // expectedLandingPath for the client fixture is /dashboard. The
    // verify page server-redirects to it on success.
    await page.waitForURL(/\/dashboard(\/|$|\?)/, { timeout: 30_000 });
  });

  test("malformed email returns 400, not 500", async ({ page }) => {
    const res = await page.request.post("/api/test/magic-link/issue", {
      data: { email: "not-an-email" },
    });
    expect(res.status()).toBe(400);
  });
});
