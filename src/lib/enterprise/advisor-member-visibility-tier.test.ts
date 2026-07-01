import { describe, expect, it } from "vitest";

import {
  clampVisibilityToModuleTier,
  describePortfolioAtTier,
  getVisibilityOptionTierState,
  isVisibilityOptionAtModuleTier,
} from "./advisor-member-visibility-tier";

const flags = {
  governanceDashboardEnabled: true,
  riskIntelligenceEnabled: true,
  workflowTasksEnabled: false,
  workflowFollowUpsEnabled: false,
};

describe("isVisibilityOptionAtModuleTier", () => {
  it("allows portfolio and product tours on Essentials", () => {
    expect(isVisibilityOptionAtModuleTier("portfolio", "ESSENTIALS")).toBe(true);
    expect(isVisibilityOptionAtModuleTier("productTours", "ESSENTIALS")).toBe(true);
  });

  it("blocks methodology below Professional", () => {
    expect(isVisibilityOptionAtModuleTier("methodology", "ESSENTIALS")).toBe(false);
    expect(isVisibilityOptionAtModuleTier("methodology", "PROFESSIONAL")).toBe(true);
  });

  it("blocks engagements below Business", () => {
    expect(isVisibilityOptionAtModuleTier("engagements", "PROFESSIONAL")).toBe(false);
    expect(isVisibilityOptionAtModuleTier("engagements", "BUSINESS")).toBe(true);
  });

  it("blocks reassessment below Platinum", () => {
    expect(isVisibilityOptionAtModuleTier("reassessment", "BUSINESS")).toBe(false);
    expect(isVisibilityOptionAtModuleTier("reassessment", "PLATINUM")).toBe(true);
  });
});

describe("describePortfolioAtTier", () => {
  it("lists essentials portfolio modules", () => {
    expect(describePortfolioAtTier("ESSENTIALS", flags)).toContain("reports");
    expect(describePortfolioAtTier("ESSENTIALS", flags)).not.toContain("risk analytics");
  });

  it("lists platinum portfolio modules", () => {
    const summary = describePortfolioAtTier("PLATINUM", flags);
    expect(summary).toContain("risk intelligence");
    expect(summary).toContain("risk analytics");
    expect(summary).toContain("signals");
  });
});

describe("getVisibilityOptionTierState", () => {
  it("marks locked options with required tier", () => {
    const state = getVisibilityOptionTierState("reassessment", "BUSINESS", flags);
    expect(state.available).toBe(false);
    expect(state.requiredTierLabel).toBe("Platinum");
  });

  it("marks included options on current tier", () => {
    const state = getVisibilityOptionTierState("engagements", "BUSINESS", flags);
    expect(state.available).toBe(true);
    expect(state.includedSummary).toContain("Business");
  });
});

describe("clampVisibilityToModuleTier", () => {
  it("forces unavailable toggles off before save", () => {
    expect(
      clampVisibilityToModuleTier(
        {
          portfolio: true,
          methodology: true,
          engagements: true,
          reassessment: true,
          productTours: true,
        },
        "ESSENTIALS",
      ),
    ).toEqual({
      portfolio: true,
      methodology: false,
      engagements: false,
      reassessment: false,
      productTours: true,
    });
  });
});
