import { execSync } from "node:child_process";
import { test, expect, type APIRequestContext } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";
import { USERS } from "../fixtures/users";

/**
 * Auth gating on the new authenticated streaming route at
 * `/api/intake/[interviewId]/audio/[questionId]` (introduced when intake
 * audio moved off `public/uploads/...` into private S3).
 *
 * Coverage:
 *  - Owner (client) gets 200 with the right Content-Type
 *  - Assigned advisor (ACTIVE ClientAdvisorAssignment) gets 200
 *  - Unassigned advisor (no assignment) gets 404, NOT 200 — regression
 *    against the original "everything in public/" architecture
 *  - Unauthenticated request gets 401
 *
 * Setup: we round-trip through the upload endpoint with a tiny webm blob
 * so we don't depend on S3 having any pre-seeded content. The seed fixture
 * `client@test.com` has an existing IntakeInterview row; we discover the
 * interview id with `scripts/get-client-intake-fixture.js`.
 */

// 27 bytes — minimum webm EBML header. Just enough that the upload route's
// MIME validation accepts it as `audio/webm` and S3 doesn't reject empty.
const TINY_WEBM = Buffer.from([
  0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81,
  0x01, 0x42, 0xf2, 0x81, 0x04, 0x42, 0xf3, 0x81, 0x08, 0x42, 0x82, 0x84,
  0x77, 0x65, 0x62, 0x6d,
]);

let interviewId: string;
let questionId: string;
let audioPath: string;

async function cookieHeaderFromPage(page: import("@playwright/test").Page) {
  const cookies = await page.context().cookies();
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

async function uploadOwnerAudio(
  request: APIRequestContext,
  cookies: string,
  iId: string,
  qId: string
): Promise<{ audioUrl: string }> {
  // FormData via Playwright APIRequestContext: pass `multipart` — supports
  // Buffer values as files with a content type.
  const resp = await request.post(`/api/intake/${iId}/audio`, {
    headers: { cookie: cookies },
    multipart: {
      audio: {
        name: `${qId}.webm`,
        mimeType: "audio/webm",
        buffer: TINY_WEBM,
      },
      questionId: qId,
    },
  });
  expect(resp.status(), await resp.text()).toBe(200);
  const body = (await resp.json()) as { success: boolean; audioUrl: string };
  expect(body.success).toBe(true);
  expect(body.audioUrl, "upload should return the new authenticated streaming URL").toMatch(
    /^\/api\/intake\/[^/]+\/audio\/[^/]+$/
  );
  return body;
}

test.describe("intake audio streaming endpoint", () => {
  test.beforeAll(() => {
    // Discover the seeded client's interviewId + questionId so we can
    // exercise the upload + streaming round-trip without coupling to a
    // particular question in the bank.
    const out = execSync("node scripts/get-client-intake-fixture.js", {
      cwd: process.cwd(),
      env: process.env,
    })
      .toString()
      .trim();
    const parsed = JSON.parse(out) as {
      interviewId: string;
      questionId: string;
    };
    interviewId = parsed.interviewId;
    questionId = parsed.questionId;
    audioPath = `/api/intake/${interviewId}/audio/${questionId}`;
  });

  test("owner receives the audio bytes (200)", async ({ page, request }) => {
    await new SignInPage(page).signInAs("client");
    const cookies = await cookieHeaderFromPage(page);

    // Plant a known audio object first — round-trips through S3.
    const upload = await uploadOwnerAudio(
      request,
      cookies,
      interviewId,
      questionId
    );
    expect(upload.audioUrl).toBe(audioPath);

    const resp = await request.get(audioPath, {
      headers: { cookie: cookies },
    });
    expect(resp.status()).toBe(200);
    expect(resp.headers()["content-type"] ?? "").toMatch(/^audio\//);

    const body = await resp.body();
    expect(body.length).toBeGreaterThan(0);
  });

  test("assigned advisor receives the audio bytes (200)", async ({
    page,
    request,
  }) => {
    // Make sure an audio object is in S3 for this question (the prior
    // test may not have run if filtered, and tests should be order-independent).
    await new SignInPage(page).signInAs("client");
    const ownerCookies = await cookieHeaderFromPage(page);
    await uploadOwnerAudio(request, ownerCookies, interviewId, questionId);

    // Switch identity to the advisor (has ACTIVE assignment to client@test.com).
    await page.context().clearCookies();
    await new SignInPage(page).signInAs("advisor");
    const advisorCookies = await cookieHeaderFromPage(page);

    const resp = await request.get(audioPath, {
      headers: { cookie: advisorCookies },
    });
    expect(resp.status()).toBe(200);
    expect(resp.headers()["content-type"] ?? "").toMatch(/^audio\//);
  });

  test("unassigned advisor gets 404 (regression: no cross-tenant audio access)", async ({
    page,
    request,
  }) => {
    // Plant audio as the owner first.
    await new SignInPage(page).signInAs("client");
    const ownerCookies = await cookieHeaderFromPage(page);
    await uploadOwnerAudio(request, ownerCookies, interviewId, questionId);

    // advisor2 is the seeded-no-assignments fixture (independent advisor,
    // their own subdomain, no link to client@test.com).
    await page.context().clearCookies();
    await new SignInPage(page).signInAs("advisor2");
    const otherCookies = await cookieHeaderFromPage(page);

    const resp = await request.get(audioPath, {
      headers: { cookie: otherCookies },
    });
    expect(
      resp.status(),
      `expected 404 for unassigned advisor (${USERS.advisor2.email}); got ${resp.status()}`
    ).toBe(404);
  });

  test("unauthenticated request gets 401", async ({ request }) => {
    // No sign-in, no cookies. Should 401 — auth check fires before the
    // existence check, so this also doesn't leak whether the path exists.
    const resp = await request.get(audioPath);
    expect(resp.status()).toBe(401);
  });
});
