import { expect, type Page } from "@playwright/test";

export class AdvisorIntakeReviewPage {
  constructor(private readonly page: Page) {}

  async expectInReviewState() {
    await expect(
      this.page.getByRole("button", { name: /approve for assessment/i })
    ).toBeVisible({ timeout: 30_000 });
  }

  async selectFocusArea(areaName: string | RegExp) {
    const label = this.page.getByText(areaName).first();
    await label.click();
  }

  async approveWithConfirmation() {
    await this.page.getByRole("button", { name: /approve for assessment/i }).click();
    await this.page.getByRole("button", { name: /confirm approval/i }).click();
    await expect(this.page.getByText(/approved/i).first()).toBeVisible({
      timeout: 30_000,
    });
  }

  async rejectWithConfirmation() {
    await this.page.getByRole("button", { name: /^reject$/i }).click();
    await this.page.getByRole("button", { name: /confirm rejection/i }).click();
    await expect(this.page.getByText(/rejected/i).first()).toBeVisible({
      timeout: 30_000,
    });
  }
}
