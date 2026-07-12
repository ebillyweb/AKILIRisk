import { execSync } from "node:child_process";
import { test, expect, type Page } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";

/**
 * Regression: a SKIPPED intake question must stay answerable when revisited.
 *
 * The bug: after skipping a question and navigating back to it, the answer
 * input rendered permanently `disabled` (greyed out), so the client could
 * never provide an answer. The fix ties `disabled` only to in-flight
 * upload/save/submit state, so a revisited skipped question is fillable again.
 *
 * Uses the dedicated `client-fresh@test.com` seed user (magic-link auth), the
 * same reset + auth pattern as tests/smoke/client-intake.spec.ts. NOT tagged
 * @smoke: client magic-link sign-in needs ENABLE_TEST_AUTH, so these client
 * specs are deliberately untagged (see client-intake.spec.ts).
 *
 * Skipped questions are forced to the "Type" tab on revisit, so we prefer the
 * textarea path. If we can only reach a structured (non-textarea) question, we
 * fall back to asserting the first answer-region control is enabled.
 */

test.beforeEach(() => {
  execSync("node scripts/reset-fresh-client-intake.js", {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });
});

const counterPattern = /Question (\d+) of (\d+)/i;

async function readCounter(page: Page): Promise<{ current: number; total: number }> {
  const text = await page.getByText(counterPattern).first().textContent();
  const match = text?.match(counterPattern);
  expect(match, `expected a "Question N of M" counter, got: ${text ?? "<none>"}`).not.toBeNull();
  return { current: Number(match![1]), total: Number(match![2]) };
}

/** True when the current question renders the audio "Type"/"Voice" tab pair. */
async function hasTypeTab(page: Page): Promise<boolean> {
  const tab = page.getByRole("tab", { name: /type/i });
  return (await tab.count()) > 0 && (await tab.first().isVisible());
}

test.describe("intake skipped-question revisit", () => {
  test("a skipped question can be answered after navigating back to it", async ({ page }) => {
    test.setTimeout(180_000);

    await new SignInPage(page).signInAs("clientFresh");

    await page.goto("/intake");
    await expect(page.getByRole("button", { name: /begin interview/i })).toBeVisible();
    await page.getByRole("button", { name: /begin interview/i }).click();

    await page.waitForURL(/\/intake\/interview/, { timeout: 30_000 });
    await expect(page.getByText(/Question 1 of \d+/i).first()).toBeVisible();

    const { total } = await readCounter(page);
    expect(total).toBeGreaterThan(1);

    const skipButton = page.getByRole("button", { name: /skip this question/i });

    // Prefer landing on a text (audio-supporting) question: skip forward until we
    // find one that shows the "Type" tab, then that skipped question is the one we
    // revisit. Never skip the last question (skipping it submits the interview).
    let landedOnTextQuestion = false;
    for (let guard = 0; guard < total; guard++) {
      const { current } = await readCounter(page);
      const onTextQuestion = await hasTypeTab(page);

      await expect(skipButton).toBeEnabled();
      await skipButton.click();

      if (onTextQuestion) {
        landedOnTextQuestion = true;
        break;
      }

      // Structured question skipped; keep looking, but stop before the last one.
      if (current + 1 >= total) break;
    }

    // Go back to the question we just skipped.
    const previousButton = page.getByRole("button", { name: /previous/i });
    await expect(previousButton).toBeEnabled();
    await previousButton.click();

    // Give the revisited question's response state a beat to settle.
    await expect(page.getByText(counterPattern).first()).toBeVisible();

    // THE KEY ASSERTION: the answer input for the revisited (previously skipped)
    // question is ENABLED again — this is what the fix restores.
    if (landedOnTextQuestion || (await hasTypeTab(page))) {
      // Skipped questions are forced to the "Type" tab; make sure it is active.
      if (await hasTypeTab(page)) {
        await page.getByRole("tab", { name: /type/i }).first().click();
      }

      const textarea = page.locator("textarea").first();
      await expect(textarea).toBeVisible();
      await expect(textarea).toBeEnabled();

      const answer = "Recovered answer after revisiting a skipped question.";
      await textarea.fill(answer);
      await expect(textarea).toHaveValue(answer);

      // Prove the full recovery path: a typed answer enables forward navigation
      // (this UI persists the answer on Next/Previous — there is no separate
      // "Save typed response" button on the current interview screen; guard for
      // it in case an audio-tab variant renders one).
      const saveButton = page.getByRole("button", { name: /save typed response/i });
      if ((await saveButton.count()) > 0 && (await saveButton.first().isVisible())) {
        await expect(saveButton.first()).toBeEnabled();
        await saveButton.first().click();
      } else {
        const nextButton = page.getByRole("button", { name: /^next$/i });
        await expect(nextButton).toBeEnabled({ timeout: 30_000 });
      }
    } else {
      // Structured (non-textarea) question fallback: assert the first answer-region
      // control inside the response card is enabled. Nav buttons live outside the
      // card, and answer controls precede the "Skip" button in DOM order.
      const answerCard = page.locator("div.rounded-3xl").first();
      const control = answerCard.locator("textarea, input, button").first();
      await expect(control).toBeVisible();
      await expect(control).toBeEnabled();
    }

    // No error toast surfaced during the recovery.
    await expect(page.getByText(/failed to (save|skip)/i)).toHaveCount(0);
  });
});
