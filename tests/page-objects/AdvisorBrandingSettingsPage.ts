import { expect, type Locator, type Page } from "@playwright/test";
import { LOGO_MAX_BYTES } from "@/lib/validation/branding";

export class AdvisorBrandingSettingsPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/advisor/settings");
    await expect(this.page.getByRole("tab", { name: /^general$/i })).toBeVisible({
      timeout: 20_000,
    });
  }

  async openBrandingTab() {
    await this.page.getByRole("tab", { name: /^branding$/i }).click();
    await expect(
      this.page.getByRole("tab", { name: /^brand identity$|^brand$/i })
    ).toBeVisible({ timeout: 20_000 });
  }

  async openTab(
    tab:
      | "identity"
      | "colors"
      | "assets"
      | "logo"
      | "support"
      | "domain"
      | "preview"
  ) {
    await this.openBrandingTab();
    const patterns: Record<string, RegExp> = {
      identity: /^brand identity$|^brand$/i,
      colors: /^colors & style$|^style$/i,
      assets: /^logo & assets$|^logo$/i,
      logo: /^logo & assets$|^logo$/i,
      support: /^client support$|^support$/i,
      domain: /^custom domain$|^domain$/i,
      preview: /^live preview$|^preview$/i,
    };
    await this.page.getByRole("tab", { name: patterns[tab] }).click();
  }

  brandNameInput(): Locator {
    return this.page.locator("#brandNameDisplay");
  }

  taglineInput(): Locator {
    return this.page.locator("#tagline");
  }

  websiteUrlInput(): Locator {
    return this.page.locator("#websiteUrl");
  }

  supportEmailInput(): Locator {
    return this.page.locator("#supportEmail");
  }

  primaryColorInput(): Locator {
    return this.page.locator("#color-Primary\\ Color");
  }

  saveButton(): Locator {
    return this.page.getByRole("button", { name: /save changes/i });
  }

  async saveChanges() {
    const save = this.saveButton();
    await expect(save).toBeEnabled({ timeout: 10_000 });
    await save.click();
    await expect(this.page.getByText(/all changes are saved/i)).toBeVisible({
      timeout: 20_000,
    });
  }

  logoFileInput(): Locator {
    return this.page.locator('input[type="file"].sr-only');
  }

  async uploadLogoFile(file: {
    name: string;
    mimeType: string;
    buffer: Buffer;
  }) {
    await this.openTab("assets");
    await this.logoFileInput().setInputFiles(file);
  }

  /** Client-side max-size guard on the branding FileUpload component. */
  static oversizedLogoFixture(): {
    name: string;
    mimeType: string;
    buffer: Buffer;
  } {
    return {
      name: "oversized-logo.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(LOGO_MAX_BYTES + 1, 0),
    };
  }
}
