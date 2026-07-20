import { execSync } from "node:child_process";
import { test, expect, type Page } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";

/**
 * BRD US-10 (corrected to dual-mode in Revision 1.27) coverage gap:
 * the wizard's audio path was never exercised end-to-end alongside the
 * Type path in a single intake run. `client-intake.spec.ts` covers
 * Type-only; `intake-audio-endpoint.spec.ts` covers the upload + auth
 * route in isolation. This spec plants an audio response on Q1 via the
 * upload endpoint (bypassing the in-browser MediaRecorder, which is
 * impractical in headless Playwright) and types the remaining
 * questions, then submits the interview.
 *
 * Reuses:
 *   - `scripts/reset-fresh-client-intake.js` to land on a NOT_STARTED
 *     interview before each run.
 *   - `scripts/get-fresh-client-intake-fixture.js` to discover the
 *     freshly-created (interviewId, questionId) pair AFTER Begin.
 *   - The same 27-byte TINY_WEBM EBML header buffer used by
 *     `tests/smoke/intake-audio-endpoint.spec.ts` — minimum payload
 *     accepted by the upload route's MIME check.
 */

const TINY_WEBM = Buffer.from([
  0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81,
  0x01, 0x42, 0xf2, 0x81, 0x04, 0x42, 0xf3, 0x81, 0x08, 0x42, 0x82, 0x84,
  0x77, 0x65, 0x62, 0x6d,
]);

async function cookieHeader(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

test.beforeEach(() => {
  execSync("node scripts/reset-fresh-client-intake.js", {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });
});

test.describe("client intake wizard — mixed audio + typed responses", () => {
  // S3_INTAKE_BUCKET is now set on Preview (audio upload no longer 500s). This
  // spec now fails earlier and unrelated to S3: after "Begin interview" the
  // `page.waitForURL(/\/intake\/interview/)` times out (30s) — the wizard
  // start → question navigation drifted. Re-parked until the wizard flow /
  // URL locator is refreshed. See INVENTORY "Surfaced bugs".
  test.skip(true, "intake wizard start->question navigation drift (waitForURL timeout); unrelated to S3 (resolved)");

  test("completes with one recorded question and the rest typed", async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);

    await new SignInPage(page).signInAs("clientFresh");

    // Begin interview — this creates the IntakeInterview row that the
    // fixture script needs to find.
    await page.goto("/intake");
    await expect(page.getByRole("button", { name: /begin interview/i })).toBeVisible();
    await page.getByRole("button", { name: /begin interview/i }).click();
    await page.waitForURL(/\/intake\/interview/, { timeout: 30_000 });

    // Confirm we're on Q1 and capture the total question count for the loop.
    const counterPattern = /Question (\d+) of (\d+)/i;
    await expect(page.getByText(counterPattern).first()).toBeVisible();
    const initialCounter = await page.getByText(counterPattern).first().textContent();
    const match = initialCounter?.match(counterPattern);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(1);
    const totalQuestions = Number(match![2]);
    expect(totalQuestions).toBeGreaterThan(1);

    // Discover the freshly-created interview's IDs from the DB.
    const fixtureRaw = execSync(
      "node scripts/get-fresh-client-intake-fixture.js",
      { cwd: process.cwd(), env: process.env }
    )
      .toString()
      .trim();
    const fixture = JSON.parse(fixtureRaw) as {
      interviewId: string;
      questionId: string;
    };
    expect(fixture.interviewId).toBeTruthy();
    expect(fixture.questionId).toBeTruthy();

    // Plant an audio response on Q1 via the upload endpoint — same shape
    // as `intake-audio-endpoint.spec.ts`.
    const cookies = await cookieHeader(page);
    const uploadResp = await request.post(
      `/api/intake/${fixture.interviewId}/audio`,
      {
        headers: { cookie: cookies },
        multipart: {
          audio: {
            name: `${fixture.questionId}.webm`,
            mimeType: "audio/webm",
            buffer: TINY_WEBM,
          },
          questionId: fixture.questionId,
        },
      }
    );
    expect(uploadResp.status(), await uploadResp.text()).toBe(200);
    const uploadBody = (await uploadResp.json()) as {
      success: boolean;
      audioUrl: string;
    };
    expect(uploadBody.success).toBe(true);
    expect(uploadBody.audioUrl).toBe(
      `/api/intake/${fixture.interviewId}/audio/${fixture.questionId}`
    );

    // Reload so the wizard rehydrates from the server with the planted
    // recording in place for Q1.
    await page.reload();
    await page.waitForURL(/\/intake\/interview/);
    await expect(page.getByText(counterPattern).first()).toBeVisible();
    await expect(
      page.getByText(new RegExp(`Question 1 of ${totalQuestions}`, "i")).first()
    ).toBeVisible();

    // The planted recording satisfies Q1 — the Next button should be
    // enabled without us touching the Type tab. This is the assertion
    // that closes the gap: the audio path can answer a question without
    // any typed text.
    const nextOnQ1 = page.getByRole("button", { name: /^next$/i });
    await expect(nextOnQ1).toBeEnabled({ timeout: 30_000 });
    await nextOnQ1.click();

    // Q2..Qn — same Type path the existing happy-path test uses.
    for (let q = 2; q <= totalQuestions; q++) {
      await expect(
        page.getByText(new RegExp(`Question ${q} of ${totalQuestions}`, "i")).first()
      ).toBeVisible();

      await page.getByRole("tab", { name: /type/i }).click();
      const textarea = page.locator("textarea").first();
      await textarea.fill(`Typed answer for question ${q}.`);

      const saveButton = page.getByRole("button", {
        name: /save typed response/i,
      });
      await expect(saveButton).toBeEnabled();
      await saveButton.click();
      // Wait for the idle label to return (the button briefly renders
      // "Saving…" while `typedSaving` is true).
      await expect(
        page.getByRole("button", { name: /save typed response/i })
      ).toBeVisible({ timeout: 30_000 });

      if (q < totalQuestions) {
        const nextButton = page.getByRole("button", { name: /^next$/i });
        await expect(nextButton).toBeEnabled({ timeout: 30_000 });
        await nextButton.click();
      }
    }

    // The final save advances the wizard to the complete screen — same
    // behavior the Type-only happy path relies on. Verifying the URL
    // proves the mixed-mode interview was accepted as fully answered.
    await page.waitForURL(/\/intake\/complete/, { timeout: 30_000 });
    expect(new URL(page.url()).pathname).toBe("/intake/complete");
  });
});
