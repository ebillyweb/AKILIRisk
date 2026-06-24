import { expect, type Page } from "@playwright/test";

/** Display names aligned with platform pillar catalog (US-12). */
export const PLATFORM_PILLAR_SLUGS = [
  "governance",
  "cyber-digital",
  "physical-security",
  "insurance",
  "geographic-environmental",
  "reputational-social",
  "liquidity-cash",
  "tax-exposure",
  "estate-succession",
  "family-governance-behavioral",
] as const;

/** @deprecated Use PLATFORM_PILLAR_SLUGS */
export const SIX_PILLAR_SLUGS = PLATFORM_PILLAR_SLUGS.slice(0, 6);

export type PlatformPillarSlug = (typeof PLATFORM_PILLAR_SLUGS)[number];
/** @deprecated */
export type SixPillarSlug = PlatformPillarSlug;

export class AssessmentHubPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/assessment");
    await expect(this.page.getByTestId("assessment-pillar-grid")).toBeVisible({
      timeout: 45_000,
    });
  }

  async expectPlatformPillarsVisible(slugs: readonly string[] = PLATFORM_PILLAR_SLUGS) {
    for (const slug of slugs) {
      await expect(this.page.getByTestId(`pillar-card-${slug}`)).toBeVisible();
    }
  }

  /** @deprecated */
  async expectSixPillarsVisible() {
    await this.expectPlatformPillarsVisible(SIX_PILLAR_SLUGS);
  }

  async openPillar(slug: string) {
    await this.page.getByTestId(`pillar-card-${slug}`).click();
    await this.page.waitForURL(new RegExp(`/assessment/${slug}/\\d+`), {
      timeout: 45_000,
    });
  }
}
