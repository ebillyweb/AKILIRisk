import { expect, type Page } from "@playwright/test";

export type MaturityValue = 0 | 1 | 2 | 3;

export class AssessmentQuestionPage {
  constructor(private readonly page: Page) {}

  async expectMaturityScaleVisible() {
    for (const value of [0, 1, 2, 3] as const) {
      await expect(this.page.getByTestId(`maturity-option-${value}`)).toBeVisible();
    }
  }

  async selectMaturity(value: MaturityValue) {
    await this.page.getByTestId(`maturity-option-${value}`).click();
    await this.waitForAnswerSaved();
  }

  async waitForAnswerSaved() {
    const saving = this.page.getByText(/^Saving\.\.\.$/i);
    if (await saving.isVisible().catch(() => false)) {
      await expect(saving).toBeHidden({ timeout: 15_000 });
    }
    // Debounced autosave (1000ms) + network
    await this.page.waitForTimeout(1_200);
  }

  async continueToNext() {
    await this.page.getByRole("button", { name: /^continue$/i }).click();
  }

  async expectQuestionNumber(current: number, total: number) {
    await expect(
      this.page.getByText(new RegExp(`${current}\\s+/\\s+${total}`))
    ).toBeVisible();
  }

  async expectMaturitySelected(value: MaturityValue) {
    const card = this.page.getByTestId(`maturity-option-${value}`);
    await expect(card).toHaveClass(/border-brand/);
  }
}
