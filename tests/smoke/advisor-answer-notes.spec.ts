import { execSync } from "node:child_process";
import { test, expect, type Page } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";

/**
 * US-46c E2E smoke: an assigned advisor can attach a per-answer note on
 * the assessment review surface
 * (`/advisor/pipeline/<clientId>/assessment/<assessmentId>`), and the
 * saved body survives a hard reload.
 *
 * Fixture: `scripts/get-client-assessment-fixture.js` is idempotent — it
 * reuses an existing Assessment + AssessmentResponse for `client@test.com`
 * or mints a minimal IN_PROGRESS pair on the fly. Matches the pattern
 * used by `tests/smoke/intake-audio-endpoint.spec.ts` (the
 * `get-client-intake-fixture.js` helper).
 *
 * Tenant-isolation coverage is in the unit suite
 * (`src/lib/actions/advisor-answer-note-actions.test.ts`) — the optional
 * "unassigned advisor sees nothing" block here is a defense-in-depth
 * cross-check at the route layer.
 */

let clientId: string;
let assessmentId: string;
let assessmentResponseId: string;
let reviewPath: string;

async function loadAssessmentFixture(): Promise<void> {
  const raw = execSync("node scripts/get-client-assessment-fixture.js", {
    cwd: process.cwd(),
    env: process.env,
  })
    .toString()
    .trim();
  const parsed = JSON.parse(raw) as {
    clientId: string;
    assessmentId: string;
    assessmentResponseId: string;
  };
  clientId = parsed.clientId;
  assessmentId = parsed.assessmentId;
  assessmentResponseId = parsed.assessmentResponseId;
  reviewPath = `/advisor/pipeline/${clientId}/assessment/${assessmentId}`;
}

async function findNotePanelForResponse(
  page: Page,
  responseId: string
) {
  // The review page renders one `section[data-testid="advisor-assessment-response-<id>"]`
  // per response, each containing the AnswerAdvisorNotePanel
  // (`data-testid="answer-advisor-note-panel"`). Scope the panel lookup
  // so we drive the right row when the assessment has multiple.
  const section = page.locator(
    `[data-testid="advisor-assessment-response-${responseId}"]`
  );
  await expect(section).toBeVisible({ timeout: 30_000 });
  return section.locator('[data-testid="answer-advisor-note-panel"]');
}

test.describe("US-46c — advisor answer notes (assessment surface)", () => {
  test.beforeAll(async () => {
    await loadAssessmentFixture();
  });

  test("assigned advisor saves a per-answer note and the body persists across reload", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    await new SignInPage(page).signInAs("advisor");

    await page.goto(reviewPath);
    await expect(
      page.getByTestId("advisor-assessment-review-page")
    ).toBeVisible({ timeout: 30_000 });

    const panel = await findNotePanelForResponse(page, assessmentResponseId);
    const noteBody = `Smoke-test note ${Date.now()}`;

    // Fill + save. The save button label flips between "Save note" /
    // "Update note" depending on whether a prior note exists; both share
    // the `answer-advisor-note-save` testid.
    await panel.locator('[data-testid="answer-advisor-note-input"]').fill(noteBody);
    await panel.locator('[data-testid="answer-advisor-note-save"]').click();

    // After a successful save the display element renders the saved body
    // (the panel hides it while `dirty` is true, but a fresh save resets
    // `savedBody` and clears `dirty`).
    await expect(
      panel.locator('[data-testid="answer-advisor-note-display"]')
    ).toHaveText(noteBody, { timeout: 30_000 });

    // Hard reload — proves the note round-tripped through the server
    // action and the advisorNotes join on getAssessmentForAdvisorReview.
    await page.reload();
    await expect(
      page.getByTestId("advisor-assessment-review-page")
    ).toBeVisible({ timeout: 30_000 });

    const panelAfterReload = await findNotePanelForResponse(
      page,
      assessmentResponseId
    );
    await expect(
      panelAfterReload.locator('[data-testid="answer-advisor-note-display"]')
    ).toHaveText(noteBody, { timeout: 30_000 });

    // Sanity-check the textarea was rehydrated with the saved body.
    await expect(
      panelAfterReload.locator('[data-testid="answer-advisor-note-input"]')
    ).toHaveValue(noteBody);
  });

  test("unassigned advisor (advisor2) cannot reach the same assessment review page", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    // advisor2 is the seeded independent advisor — no assignment to
    // client@test.com. The assessment-review query returns null for
    // unassigned advisors and the page calls notFound() ⇒ 404.
    await new SignInPage(page).signInAs("advisor2");

    const resp = await page.goto(reviewPath);
    // notFound() in a server component renders the framework 404 page
    // with a 404 status. Accept either the status code or a visible
    // not-found indicator — Next renders the same screen either way.
    if (resp) {
      expect(
        resp.status(),
        `expected 404 for unassigned advisor at ${reviewPath}; got ${resp.status()}`
      ).toBe(404);
    }
    // Belt-and-suspenders: the advisor review page test-id MUST NOT be
    // present on a 404 render — if a refactor accidentally rendered the
    // page anyway, this assertion catches it.
    await expect(
      page.getByTestId("advisor-assessment-review-page")
    ).toHaveCount(0);
  });
});
