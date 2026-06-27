import { expect, type Page } from "@playwright/test";
import { SIX_PILLAR_SLUGS } from "./AssessmentHubPage";

export class ClientDashboardPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/dashboard");
    await expect(
      this.page.getByRole("heading", { name: /Explore your portal/i })
    ).toBeVisible({ timeout: 45_000 });
  }

  /** Heat map detail lives on Risk Preview—not the dashboard hub. */
  async gotoRiskPreview() {
    await this.page.goto("/assessment/risk-preview");
    await expect(
      this.page.getByRole("heading", { name: /risk by domain/i })
    ).toBeVisible({ timeout: 45_000 });
  }

  async expectHeatMapPopulated() {
    const heatMap = this.page.getByTestId("risk-heat-map-single");
    await expect(heatMap).toBeVisible();

    await expect(
      heatMap.getByText(/No scored assessment yet/i)
    ).not.toBeVisible();

    for (const slug of SIX_PILLAR_SLUGS) {
      const cell = heatMap.locator(`[data-pillar-id="${slug}"]`);
      await expect(cell).toBeVisible();
      await expect(cell).not.toHaveAttribute("data-risk-level", "unassessed");
      await expect(cell).toContainText(/\d\.\d \/ 3/);
    }
  }

  async expectTopRisksVisible() {
    const list = this.page.getByTestId("risk-preview-top-risks");
    await expect(list).toBeVisible();
    await expect(list.locator("li").first()).toBeVisible();
  }
}
