import { test, expect, type APIRequestContext } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";
import type { Page } from "@playwright/test";

// Relative path so the request inherits playwright.config.ts's `baseURL`
// (and any PLAYWRIGHT_BASE_URL override). Matches the rest of tests/smoke/.
const LOGO_URL = "/api/client/advisor-logo";
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

async function cookieHeaderFromPage(page: Page) {
  const cookies = await page.context().cookies();
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

async function getLogo(request: APIRequestContext, cookies?: string) {
  return request.get(LOGO_URL, cookies ? { headers: { cookie: cookies } } : undefined);
}

test.describe("advisor-logo endpoint", () => {
  test("unauthenticated GET returns 401", async ({ request }) => {
    const resp = await getLogo(request);
    expect(resp.status()).toBe(401);
  });

  test("non-USER role (admin) is blocked with 403", async ({ page, request }) => {
    await new SignInPage(page).signInAs("admin");
    const cookies = await cookieHeaderFromPage(page);
    const resp = await getLogo(request, cookies);
    expect(resp.status()).toBe(403);
  });

  test("client receives the assigned advisor's logo as image bytes", async ({ page, request }) => {
    await new SignInPage(page).signInAs("client");
    const cookies = await cookieHeaderFromPage(page);
    const resp = await getLogo(request, cookies);

    expect(resp.status()).toBe(200);
    expect(resp.headers()["content-type"] || "").toMatch(/^image\//);

    const body = await resp.body();
    expect(body.length).toBeGreaterThan(100);

    const head = body.subarray(0, PNG_MAGIC.length);
    const jpegHead = body.subarray(0, JPEG_MAGIC.length);
    const isPng = head.equals(PNG_MAGIC);
    const isJpeg = jpegHead.equals(JPEG_MAGIC);
    expect(
      isPng || isJpeg,
      `expected PNG or JPEG magic bytes, got ${head.toString("hex")}`
    ).toBe(true);
  });
});
