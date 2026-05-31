import { test, expect } from "@playwright/test";

/**
 * Sweep regression: every advisor API route that previously caught
 * `requireAdvisorRole()`'s thrown auth Error inside its generic 500
 * handler now maps it to 401 via the shared `isAdvisorAuthError(e)`
 * helper in `src/lib/advisor/auth.ts`. See "Fixed" in tests/INVENTORY.md.
 *
 * Each case sends an unauthenticated request with the route's expected
 * verb and a minimal valid body shape; the assertion is that the response
 * is 401 (not 500). For the binary `/view` endpoint the body is empty
 * `NextResponse(null, { status: 401 })`; the rest return JSON.
 */
test.describe("advisor API authz sweep — unauthenticated → 401", () => {
  test("DELETE /api/advisor/branding/logo", async ({ request }) => {
    const r = await request.delete("/api/advisor/branding/logo");
    expect(r.status()).toBe(401);
  });

  test("POST /api/advisor/branding/logo/direct", async ({ request }) => {
    // Empty multipart body — the schema rejects 'missing file' if auth
    // passes, but auth fails first so we get 401 here.
    const r = await request.post("/api/advisor/branding/logo/direct", {
      multipart: {},
    });
    expect(r.status()).toBe(401);
  });

  test("POST /api/advisor/branding/logo/confirm", async ({ request }) => {
    const r = await request.post("/api/advisor/branding/logo/confirm", {
      data: { uploadId: "x", s3Key: "x", originalFileName: "x.png" },
    });
    expect(r.status()).toBe(401);
  });

  test("POST /api/advisor/branding/logo/upload-url", async ({ request }) => {
    const r = await request.post("/api/advisor/branding/logo/upload-url", {
      data: { fileName: "x.png", fileType: "image/png", fileSize: 100 },
    });
    expect(r.status()).toBe(401);
  });

  test("GET /api/advisor/branding/logo/view", async ({ request }) => {
    const r = await request.get("/api/advisor/branding/logo/view");
    expect(r.status()).toBe(401);
  });

  test("POST /api/advisor/subdomain/check", async ({ request }) => {
    const r = await request.post("/api/advisor/subdomain/check", {
      data: { subdomain: "test-subdomain" },
    });
    expect(r.status()).toBe(401);
  });

  test("POST /api/advisor/subdomain/claim", async ({ request }) => {
    const r = await request.post("/api/advisor/subdomain/claim", {
      data: { subdomain: "test-subdomain" },
    });
    expect(r.status()).toBe(401);
  });

  test("DELETE /api/advisor/subdomain/claim", async ({ request }) => {
    const r = await request.delete("/api/advisor/subdomain/claim");
    expect(r.status()).toBe(401);
  });
});
