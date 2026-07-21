import { execSync } from "node:child_process";
import { test, expect, type APIRequestContext } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";
import { USERS } from "../fixtures/users";

/**
 * Auth gating on the authenticated streaming route at
 * `/api/intake/[interviewId]/audio/[questionId]` (intake audio moved off
 * `public/uploads/...` into private S3).
 *
 * Coverage:
 *  - Owner (client) gets 200 with the right Content-Type
 *  - Assigned advisor (ACTIVE ClientAdvisorAssignment) gets 200
 *  - Platform admin (no assignment required) gets 200
 *  - Unassigned advisor (no assignment) gets 404, NOT 200 — regression
 *    against the original "everything in public/" architecture
 *  - Unauthenticated request gets 401
 *
 * Fixture: everything runs on `client-fresh@test.com`, who is seeded with an
 * ACTIVE assignment to `advisor@test.com` (see scripts/seed-advisor-test-data.js)
 * and can be reset to a clean, editable intake state. `beforeEach` wipes their
 * interview rows; each test then `beginFreshInterview()`s a NOT_STARTED
 * interview via `GET /api/intake/script` (the same get-or-create the wizard
 * uses) so the upload route accepts audio for it. We deliberately do NOT touch
 * `client@test.com`, whose SUBMITTED+Approved intake other specs depend on and
 * which the upload route (correctly) rejects with 409.
 */

// 28 bytes — minimum webm EBML header. Just enough that the upload route's
// MIME validation accepts it as `audio/webm` and S3 doesn't reject empty.
const TINY_WEBM = Buffer.from([
  0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81,
  0x01, 0x42, 0xf2, 0x81, 0x04, 0x42, 0xf3, 0x81, 0x08, 0x42, 0x82, 0x84,
  0x77, 0x65, 0x62, 0x6d,
]);

async function cookieHeaderFromPage(page: import("@playwright/test").Page) {
  const cookies = await page.context().cookies();
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

/**
 * Deterministic "Begin interview": `GET /api/intake/script` returns the
 * question set and get-or-creates a NOT_STARTED interview when none is active.
 * Uses the API the wizard itself relies on, so it doesn't depend on the intake
 * wizard UI (whose start→question navigation has drifted — see
 * intake-mixed-mode.spec.ts). Returns an editable interview owned by the caller.
 */
async function beginFreshInterview(
  request: APIRequestContext,
  cookies: string
): Promise<{ interviewId: string; questionId: string }> {
  const resp = await request.get("/api/intake/script", {
    headers: { cookie: cookies },
  });
  expect(resp.status(), await resp.text()).toBe(200);
  const body = (await resp.json()) as {
    interviewId: string;
    status: string;
    questions: { id: string }[];
  };
  expect(body.interviewId).toBeTruthy();
  expect(
    body.questions.length,
    "intake script should expose at least one question"
  ).toBeGreaterThan(0);
  return { interviewId: body.interviewId, questionId: body.questions[0].id };
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

async function uploadOwnerAudioWithMime(
  request: APIRequestContext,
  cookies: string,
  iId: string,
  qId: string,
  mimeType: string
): Promise<{ audioUrl: string }> {
  const resp = await request.post(`/api/intake/${iId}/audio`, {
    headers: { cookie: cookies },
    multipart: {
      audio: {
        name: `${qId}.webm`,
        mimeType,
        buffer: TINY_WEBM,
      },
      questionId: qId,
    },
  });
  expect(resp.status(), await resp.text()).toBe(200);
  const body = (await resp.json()) as { success: boolean; audioUrl: string };
  expect(body.success).toBe(true);
  return body;
}

test.describe("intake audio streaming endpoint", () => {
  // Reset client-fresh to a clean (no-interview) state before each test so
  // beginFreshInterview always creates a fresh, editable interview. Reuses the
  // existing helper (also used by client-intake.spec.ts / intake-mixed-mode).
  test.beforeEach(() => {
    execSync("node scripts/reset-fresh-client-intake.js", {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });
  });

  test("accepts parameterized MediaRecorder MIME types (200)", async ({
    page,
    request,
  }) => {
    await new SignInPage(page).signInAs("clientFresh");
    const cookies = await cookieHeaderFromPage(page);
    const { interviewId, questionId } = await beginFreshInterview(request, cookies);

    await uploadOwnerAudioWithMime(
      request,
      cookies,
      interviewId,
      questionId,
      "audio/webm;codecs=opus"
    );
    await uploadOwnerAudioWithMime(
      request,
      cookies,
      interviewId,
      questionId,
      "audio/mp4;codecs=mp4a.40.2"
    );
  });

  test("owner receives the audio bytes (200)", async ({ page, request }) => {
    await new SignInPage(page).signInAs("clientFresh");
    const cookies = await cookieHeaderFromPage(page);
    const { interviewId, questionId } = await beginFreshInterview(request, cookies);
    const audioPath = `/api/intake/${interviewId}/audio/${questionId}`;

    // Plant a known audio object first — round-trips through S3.
    const upload = await uploadOwnerAudio(request, cookies, interviewId, questionId);
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
    // Plant audio as the owner (client-fresh).
    await new SignInPage(page).signInAs("clientFresh");
    const ownerCookies = await cookieHeaderFromPage(page);
    const { interviewId, questionId } = await beginFreshInterview(request, ownerCookies);
    await uploadOwnerAudio(request, ownerCookies, interviewId, questionId);
    const audioPath = `/api/intake/${interviewId}/audio/${questionId}`;

    // Switch identity to the advisor (ACTIVE assignment to client-fresh).
    await page.context().clearCookies();
    await new SignInPage(page).signInAs("advisor");
    const advisorCookies = await cookieHeaderFromPage(page);

    const resp = await request.get(audioPath, {
      headers: { cookie: advisorCookies },
    });
    expect(resp.status()).toBe(200);
    expect(resp.headers()["content-type"] ?? "").toMatch(/^audio\//);
  });

  test("platform admin receives the audio bytes (200)", async ({
    page,
    request,
  }) => {
    await new SignInPage(page).signInAs("clientFresh");
    const ownerCookies = await cookieHeaderFromPage(page);
    const { interviewId, questionId } = await beginFreshInterview(request, ownerCookies);
    await uploadOwnerAudio(request, ownerCookies, interviewId, questionId);
    const audioPath = `/api/intake/${interviewId}/audio/${questionId}`;

    await page.context().clearCookies();
    await new SignInPage(page).signInAs("admin");
    const adminCookies = await cookieHeaderFromPage(page);

    const resp = await request.get(audioPath, {
      headers: { cookie: adminCookies },
    });
    expect(resp.status()).toBe(200);
    expect(resp.headers()["content-type"] ?? "").toMatch(/^audio\//);
  });

  test("unassigned advisor gets 404 (regression: no cross-tenant audio access)", async ({
    page,
    request,
  }) => {
    // Plant audio as the owner first.
    await new SignInPage(page).signInAs("clientFresh");
    const ownerCookies = await cookieHeaderFromPage(page);
    const { interviewId, questionId } = await beginFreshInterview(request, ownerCookies);
    await uploadOwnerAudio(request, ownerCookies, interviewId, questionId);
    const audioPath = `/api/intake/${interviewId}/audio/${questionId}`;

    // advisor2 is the seeded-no-assignments fixture (independent advisor,
    // their own subdomain, no link to client-fresh@test.com).
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
    // No sign-in, no cookies. Auth check fires before the existence check, so a
    // valid-format but nonexistent path still 401s (doesn't leak existence).
    const resp = await request.get(
      "/api/intake/test-interview-000000000000000000000000/audio/q1"
    );
    expect(resp.status()).toBe(401);
  });
});
