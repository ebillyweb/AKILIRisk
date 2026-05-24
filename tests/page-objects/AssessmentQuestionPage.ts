import { expect, type Page } from "@playwright/test";

/** Canonical maturity labels (US-13 / maturity-scale.ts). */
export const MATURITY_LEVEL_LABELS = [
  "Critical gap",
  "Partial / informal",
  "Formalized",
  "Institutionalized",
] as const;

export type MaturityValue = 0 | 1 | 2 | 3;

export class AssessmentQuestionPage {
  constructor(private readonly page: Page) {}

  async expectMaturityScaleVisible() {
    for (const label of MATURITY_LEVEL_LABELS) {
      await expect(this.page.getByText(label, { exact: true }).first()).toBeVisible();
    }
    await expect(
      this.page.getByText(/Maturity scale \(0–3\)/i)
    ).toBeVisible();
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
