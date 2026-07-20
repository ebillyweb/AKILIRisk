import { test, expect, type APIRequestContext } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";

/**
 * White-label PDF branding canary.
 *
 * Renders a synthetic AssessmentReport PDF with fixed advisor branding via
 * `POST /api/pdf/white-label-smoke-probe`. Asserts the firm name is embedded
 * in the PDF bytes (cover + confidentiality + metadata path) so a regression
 * that drops white-label copy or falls back to platform defaults fails the
 * scheduled preview run.
 *
 * Canary contract:
 *   - Advisor password login only (no client magic-link / ENABLE_TEST_AUTH).
 *   - No assessment DB reads or writes — fixed synthetic snapshot + branding.
 */

const PROBE_PATH = "/api/pdf/white-label-smoke-probe";
const EXPECTED_FIRM = "Smoke WL PDF Partners LLC";
const EXPECTED_SLUG = "smoke-wl-pdf-partners-llc";

async function cookieHeaderFromPage(page: import("@playwright/test").Page) {
  const cookies = await page.context().cookies();
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

async function postWhiteLabelPdfProbe(
  request: APIRequestContext,
  cookies: string | undefined,
) {
  return request.post(PROBE_PATH, {
    headers: {
      ...(cookies ? { cookie: cookies } : {}),
    },
  });
}

function probeFailureHint(
  status: number,
  payload: { error?: string },
  rawBody: string,
): string {
  return [
    "White-label PDF branding probe failed",
    `status=${status}`,
    payload.error ? `error=${payload.error}` : null,
    rawBody ? `body=${rawBody.slice(0, 240)}` : null,
  ]
    .filter(Boolean)
    .join(" — ");
}

test.describe("white-label PDF branding", () => {
  test("unauthenticated POST returns 401", async ({ request }) => {
    const response = await postWhiteLabelPdfProbe(request, undefined);
    expect(response.status()).toBe(401);
  });

  test(
    "advisor receives a PDF with white-label firm branding embedded",
    { tag: "@smoke" },
    async ({ page, request }) => {
      test.setTimeout(90_000);

      await new SignInPage(page).signInAs("advisor");
      const cookies = await cookieHeaderFromPage(page);

      const response = await postWhiteLabelPdfProbe(request, cookies);
      const status = response.status();
      const contentType = response.headers()["content-type"] ?? "";

      if (status !== 200) {
        const rawBody = await response.text();
        let payload: { error?: string } = {};
        try {
          payload = JSON.parse(rawBody) as { error?: string };
        } catch {
          // non-JSON error body
        }
        expect(status, probeFailureHint(status, payload, rawBody)).toBe(200);
        return;
      }

      expect(contentType).toMatch(/application\/pdf/i);
      expect(response.headers()["x-smoke-firm-name"]).toBe(EXPECTED_FIRM);
      expect(response.headers()["x-smoke-firm-slug"]).toBe(EXPECTED_SLUG);
      expect(response.headers()["x-smoke-firm-embedded"]).toBe("1");

      const disposition = response.headers()["content-disposition"] ?? "";
      expect(disposition).toContain(`${EXPECTED_SLUG}-smoke-wl-report.pdf`);

      const bytes = await response.body();
      expect(bytes.byteLength).toBeGreaterThan(1000);
      expect(Buffer.from(bytes).subarray(0, 4).toString()).toBe("%PDF");

      const latin1 = Buffer.from(bytes).toString("latin1");
      expect(
        latin1.includes(EXPECTED_FIRM),
        "PDF bytes must embed the white-label firm name on the cover",
      ).toBe(true);
    },
  );
});
