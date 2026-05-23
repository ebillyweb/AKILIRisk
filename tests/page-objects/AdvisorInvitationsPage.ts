import { expect, type Page } from "@playwright/test";

export class AdvisorInvitationsPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/advisor/invitations");
    await expect(
      this.page.getByRole("heading", { name: /Send New Invitation/i })
    ).toBeVisible();
  }

  async sendInvitation(options: {
    clientEmail: string;
    clientName?: string;
    personalMessage?: string;
    intakeWaived?: boolean;
  }) {
    await this.page.locator("#clientEmail").fill(options.clientEmail);
    if (options.clientName) {
      await this.page.locator("#clientName").fill(options.clientName);
    }
    if (options.personalMessage) {
      await this.page.locator("#personalMessage").fill(options.personalMessage);
    }
    if (options.intakeWaived) {
      await this.page.locator("#intakeWaived").check();
    }
    await this.page
      .getByRole("button", { name: /^Send Invitation$/i })
      .click();
  }

  async expectInvitationRow(email: string) {
    const row = this.page.locator("tbody tr").filter({ hasText: email });
    await expect(row).toBeVisible();
    return row;
  }

  async expectStatusForEmail(email: string, statusLabel: RegExp) {
    const row = await this.expectInvitationRow(email);
    await expect(row.getByText(statusLabel)).toBeVisible();
  }

  async applyFilters(options: { status?: string; search?: string }) {
    if (options.status) {
      await this.page.locator("#invitation-status-filter").click();
      await this.page.getByRole("option", { name: options.status }).click();
    }
    if (options.search) {
      await this.page.locator("#invitation-search").fill(options.search);
    }
    await this.page.getByRole("button", { name: /^Apply$/i }).click();
  }

  async resendForEmail(email: string) {
    const row = await this.expectInvitationRow(email);
    await row.getByRole("button", { name: /^Resend$/i }).click();
  }

  async expireForEmail(email: string) {
    const row = await this.expectInvitationRow(email);
    this.page.once("dialog", (dialog) => dialog.accept());
    await row.getByRole("button", { name: /^Expire$/i }).click();
  }

  async expectResendHiddenForEmail(email: string) {
    const row = await this.expectInvitationRow(email);
    await expect(row.getByRole("button", { name: /^Resend$/i })).toHaveCount(0);
  }
}
