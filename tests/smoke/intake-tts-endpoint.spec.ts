import { test, expect, type APIRequestContext } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";

const INTAKE_TTS_PATH = "/api/intake/tts";
const SMOKE_QUESTION_TEXT = "How did your advisor describe our firm?";

function playwrightBaseHostname(): string {
  try {
    return new URL(
      process.env.PLAYWRIGHT_BASE_URL ?? "https://preview.akilirisk.com",
    ).hostname;
  } catch {
    return "preview.akilirisk.com";
  }
}

/** Local runs need the app configured; preview is the scheduled smoke target. */
function intakeTtsSynthesisE2EAllowed(): boolean {
  const host = playwrightBaseHostname();
  const isLocal = host === "localhost" || host === "127.0.0.1";
  if (isLocal) return true;
  return process.env.E2E_INTAKE_TTS_REMOTE === "1";
}

async function cookieHeaderFromPage(page: import("@playwright/test").Page) {
  const cookies = await page.context().cookies();
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

async function postIntakeTts(
  request: APIRequestContext,
  cookies: string | undefined,
  body: Record<string, unknown>,
) {
  return request.post(INTAKE_TTS_PATH, {
    headers: {
      "content-type": "application/json",
      ...(cookies ? { cookie: cookies } : {}),
    },
    data: body,
  });
}

async function readTtsErrorPayload(response: import("@playwright/test").APIResponse) {
  try {
    return (await response.json()) as { error?: string };
  } catch {
    return {};
  }
}

function skipWhenOpenAiKeyMissing(status: number, payload: { error?: string }) {
  if (status === 503 && payload.error?.includes("OPENAI_API_KEY")) {
    test.skip(
      true,
      "OPENAI_API_KEY is not configured on the target deployment",
    );
  }
}

function synthesisFailureHint(
  status: number,
  payload: { error?: string },
  rawBody: string,
): string {
  return [
    "intake TTS synthesis failed",
    `status=${status}`,
    payload.error ? `error=${payload.error}` : null,
    "If preview recently exhausted OpenAI quota, replenish credits and rerun smoke.",
    rawBody ? `body=${rawBody.slice(0, 240)}` : null,
  ]
    .filter(Boolean)
    .join(" — ");
}

test.describe("intake question TTS endpoint", () => {
  test("unauthenticated POST returns 401", async ({ request }) => {
    const response = await postIntakeTts(request, undefined, {
      questionText: SMOKE_QUESTION_TEXT,
    });
    expect(response.status()).toBe(401);
  });

  test(
    "advisor receives mp3 bytes for question text (quota canary)",
    { tag: "@smoke" },
    async ({ page, request }) => {
      test.setTimeout(90_000);

      await new SignInPage(page).signInAs("advisor");
      const cookies = await cookieHeaderFromPage(page);

      const response = await postIntakeTts(request, cookies, {
        questionText: SMOKE_QUESTION_TEXT,
      });
      const status = response.status();
      const contentType = response.headers()["content-type"] ?? "";
      const body = await response.body();

      if (status !== 200) {
        const rawBody = body.toString("utf8");
        let payload: { error?: string } = {};
        try {
          payload = JSON.parse(rawBody) as { error?: string };
        } catch {
          // non-JSON error body
        }
        skipWhenOpenAiKeyMissing(status, payload);
        expect(status, synthesisFailureHint(status, payload, rawBody)).toBe(200);
        return;
      }

      expect(contentType).toMatch(/^audio\/mpeg/);
      expect(body.length).toBeGreaterThan(100);
    },
  );

  test.describe("authenticated synthesis (full e2e)", () => {
    test.skip(
      !intakeTtsSynthesisE2EAllowed(),
      "Full intake TTS e2e uses localhost by default, or set E2E_INTAKE_TTS_REMOTE=1 for remote synthesis checks",
    );

    test("legacy payload fields do not fail validation", async ({ page, request }) => {
      test.setTimeout(90_000);

      await new SignInPage(page).signInAs("advisor");
      const cookies = await cookieHeaderFromPage(page);

      const response = await postIntakeTts(request, cookies, {
        questionText: SMOKE_QUESTION_TEXT,
        context: "x".repeat(5000),
        recordingTips: ["y".repeat(600)],
        moduleName: "Intake",
        questionNumber: 1,
        totalQuestions: 12,
      });

      const payload = await readTtsErrorPayload(response);
      skipWhenOpenAiKeyMissing(response.status(), payload);

      expect(response.status(), await response.text()).toBe(200);
      expect(response.headers()["content-type"] ?? "").toMatch(/^audio\/mpeg/);
    });
  });
});
