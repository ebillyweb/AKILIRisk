import { expect, type Page } from "@playwright/test";

/**
 * Complete the intake interview via the Type tab (all scripted questions).
 * Caller must have navigated to /intake and started the interview, or pass
 * `fromLanding: true` to click Begin interview first.
 */
export async function completeIntakeViaTypeTab(
  page: Page,
  options?: { fromLanding?: boolean }
): Promise<void> {
  if (options?.fromLanding) {
    await page.goto("/intake");
    await page.getByRole("button", { name: /begin interview/i }).click();
    await page.waitForURL(/\/intake\/interview/, { timeout: 30_000 });
  }

  const counterPattern = /Question (\d+) of (\d+)/i;
  const initialCounter = await page.getByText(counterPattern).first().textContent();
  const match = initialCounter?.match(counterPattern);
  expect(match).not.toBeNull();
  const totalQuestions = Number(match![2]);
  expect(totalQuestions).toBeGreaterThan(0);

  for (let q = 1; q <= totalQuestions; q++) {
    await expect(
      page.getByText(new RegExp(`Question ${q} of ${totalQuestions}`, "i")).first()
    ).toBeVisible();

    await page.getByRole("tab", { name: /type/i }).click();
    const textarea = page.locator("textarea").first();
    await textarea.fill(`E2E intake answer for question ${q}.`);

    const saveButton = page.getByRole("button", { name: /save typed response/i });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    await expect(
      page.getByRole("button", { name: /save typed response/i })
    ).toBeVisible({ timeout: 30_000 });

    if (q < totalQuestions) {
      const nextButton = page.getByRole("button", { name: /^next$/i });
      await expect(nextButton).toBeEnabled({ timeout: 30_000 });
      await nextButton.click();
    }
  }

  await page.waitForURL(/\/intake\/complete/, { timeout: 30_000 });
}
