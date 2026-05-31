import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";
import { USERS } from "../fixtures/users";
import { RISK_SIGNALS_FIXTURE } from "../fixtures/risk-signals";

/**
 * Data-correctness smokes for risk signals (admin aggregates + advisor feed).
 *
 * Requires deterministic DB fixtures:
 *   node scripts/seed-advisor-test-data.js
 *   node scripts/seed-risk-signals-fixtures.js
 *
 * Contract: tests/fixtures/risk-signals.ts
 */
test.describe("risk signals data correctness", () => {
  test.describe("admin platform aggregates", () => {
    test("tenant exposure rows match fixture clients per advisor", async ({
      page,
    }) => {
      await new SignInPage(page).signInAs("admin");
      const response = await page.goto("/admin/risk-signals");
      expect(response?.status()).toBe(200);

      const advisorBRow = page
        .getByRole("row")
        .filter({ hasText: USERS.advisor2.email });
      await expect(advisorBRow).toBeVisible();

      const bCells = advisorBRow.getByRole("cell");
      await expect(bCells.nth(1)).toHaveText(
        String(RISK_SIGNALS_FIXTURE.tenantB.familiesWithAssessment)
      );
      await expect(bCells.nth(2)).toHaveText(
        String(RISK_SIGNALS_FIXTURE.tenantB.familiesAtRisk)
      );
      await expect(bCells.nth(3)).toHaveText(
        String(RISK_SIGNALS_FIXTURE.tenantB.criticalIndicators)
      );

      const advisorARow = page
        .getByRole("row")
        .filter({ hasText: USERS.advisor.email });
      await expect(advisorARow).toBeVisible();
      const aAtRisk = Number(
        await advisorARow.getByRole("cell").nth(2).innerText()
      );
      const aCritical = Number(
        await advisorARow.getByRole("cell").nth(3).innerText()
      );
      expect(aAtRisk).toBeGreaterThanOrEqual(
        RISK_SIGNALS_FIXTURE.tenantAMin.familiesAtRisk
      );
      expect(aCritical).toBeGreaterThanOrEqual(
        RISK_SIGNALS_FIXTURE.tenantAMin.criticalIndicators
      );

      await expect(
        advisorBRow.getByText(RISK_SIGNALS_FIXTURE.signalTitleB)
      ).not.toBeVisible();
      await expect(
        advisorARow.getByText(RISK_SIGNALS_FIXTURE.signalTitleA)
      ).not.toBeVisible();
    });
  });

  test.describe("advisor signal feed tenant isolation", () => {
    test("advisor A sees only their fixture signals within the 90-day window", async ({
      page,
    }) => {
      await new SignInPage(page).signInAs("advisor");
      await page.goto("/advisor/signals");

      for (const title of RISK_SIGNALS_FIXTURE.advisorFeed.advisorAVisibleTitles) {
        await expect(page.getByText(title)).toBeVisible();
      }
      for (const title of RISK_SIGNALS_FIXTURE.advisorFeed.advisorAHiddenTitles) {
        await expect(page.getByText(title)).not.toBeVisible();
      }
    });

    test("advisor B sees only their fixture signals within the 90-day window", async ({
      page,
    }) => {
      await new SignInPage(page).signInAs("advisor2");
      await page.goto("/advisor/signals");

      for (const title of RISK_SIGNALS_FIXTURE.advisorFeed.advisorBVisibleTitles) {
        await expect(page.getByText(title)).toBeVisible();
      }
      for (const title of RISK_SIGNALS_FIXTURE.advisorFeed.advisorBHiddenTitles) {
        await expect(page.getByText(title)).not.toBeVisible();
      }
    });
  });
});
