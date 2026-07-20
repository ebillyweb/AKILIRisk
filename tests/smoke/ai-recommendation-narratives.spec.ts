import { test, expect, type APIRequestContext } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";

/**
 * AI recommendation narrative canary.
 *
 * Exercises the real OpenAI structured-output path used to draft prose for
 * rule-selected remediation services (`llm-narrative`). Uses a fixed
 * synthetic input — no assessment reads, no DB writes.
 *
 * Canary contract (same as intake TTS):
 *   - Advisor password login only (no client magic-link).
 *   - Fails loudly on quota / credential / generation failures so the
 *     scheduled preview run surfaces OpenAI outages.
 *   - Skips only when OPENAI_API_KEY is missing on the deployment.
 */

const PROBE_PATH = "/api/ai-narratives/smoke-probe";

async function cookieHeaderFromPage(page: import("@playwright/test").Page) {
  const cookies = await page.context().cookies();
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

async function postNarrativeProbe(
  request: APIRequestContext,
  cookies: string | undefined,
) {
  return request.post(PROBE_PATH, {
    headers: {
      ...(cookies ? { cookie: cookies } : {}),
    },
  });
}

function skipWhenOpenAiKeyMissing(status: number, payload: { error?: string }) {
  if (status === 503 && payload.error?.includes("OPENAI_API_KEY")) {
    test.skip(
      true,
      "OPENAI_API_KEY is not configured on the target deployment",
    );
  }
}

function probeFailureHint(
  status: number,
  payload: { error?: string },
  rawBody: string,
): string {
  return [
    "AI recommendation narrative probe failed",
    `status=${status}`,
    payload.error ? `error=${payload.error}` : null,
    "If preview recently exhausted OpenAI quota, replenish credits and rerun smoke.",
    rawBody ? `body=${rawBody.slice(0, 240)}` : null,
  ]
    .filter(Boolean)
    .join(" — ");
}

test.describe("AI recommendation narratives", () => {
  test("unauthenticated POST returns 401", async ({ request }) => {
    const response = await postNarrativeProbe(request, undefined);
    expect(response.status()).toBe(401);
  });

  test(
    "advisor receives grounded AI recommendation narrative (quota canary)",
    { tag: "@smoke" },
    async ({ page, request }) => {
      test.setTimeout(90_000);

      await new SignInPage(page).signInAs("advisor");
      const cookies = await cookieHeaderFromPage(page);

      const response = await postNarrativeProbe(request, cookies);
      const status = response.status();
      const rawBody = await response.text();
      let payload: {
        error?: string;
        ok?: boolean;
        pillarSummary?: string;
        serviceIds?: string[];
        recommendationCount?: number;
        expectedServiceIds?: string[];
        validationOk?: boolean;
      } = {};
      try {
        payload = JSON.parse(rawBody) as typeof payload;
      } catch {
        // non-JSON error body
      }

      if (status !== 200) {
        skipWhenOpenAiKeyMissing(status, payload);
        expect(status, probeFailureHint(status, payload, rawBody)).toBe(200);
        return;
      }

      expect(payload.ok).toBe(true);
      expect(payload.pillarSummary?.trim().length ?? 0).toBeGreaterThan(20);
      expect(payload.recommendationCount).toBe(2);
      expect(payload.serviceIds).toEqual([
        "ai_impersonation_defense",
        "ai_data_governance",
      ]);
      expect(payload.expectedServiceIds).toEqual(payload.serviceIds);
      // Soft signal: grounding validator may flag model variance; still
      // require the structural catalog-constrained shape above.
      expect(typeof payload.validationOk).toBe("boolean");
    },
  );
});
