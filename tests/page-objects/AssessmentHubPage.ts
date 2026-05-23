import { expect, type Page } from "@playwright/test";

/** Display names aligned with `RISK_AREAS` in src/lib/advisor/types.ts (US-12). */
export const SIX_PILLAR_SLUGS = [
  "governance",
  "cyber-digital",
  "physical-security",
  "insurance",
  "geographic-environmental",
  "reputational-social",
] as const;

export type SixPillarSlug = (typeof SIX_PILLAR_SLUGS)[number];

export class AssessmentHubPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/assessment");
    await expect(this.page.getByTestId("assessment-pillar-grid")).toBeVisible({
      timeout: 45_000,
    });
  }

  async expectSixPillarsVisible() {
    for (const slug of SIX_PILLAR_SLUGS) {
      await expect(this.page.getByTestId(`pillar-card-${slug}`)).toBeVisible();
    }
  }

  async openPillar(slug: SixPillarSlug) {
    await this.page.getByTestId(`pillar-card-${slug}`).click();
    await this.page.waitForURL(new RegExp(`/assessment/${slug}/\\d+`), {
      timeout: 45_000,
    });
  }
}
