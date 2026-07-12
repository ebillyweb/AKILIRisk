import { describe, expect, it } from "vitest";

import {
  clampVisibilityToModuleTier,
  describePortfolioAtTier,
  getVisibilityOptionTierState,
  isVisibilityOptionAtModuleTier,
  minimumTierForPortfolioConfiguration,
} from "./advisor-member-visibility-tier";

const flags = {
  governanceDashboardEnabled: true,
  riskIntelligenceEnabled: true,
  workflowTasksEnabled: false,
  workflowFollowUpsEnabled: false,
  monitoringEnabled: false,
};

describe("isVisibilityOptionAtModuleTier", () => {
  it("allows portfolio and product tours on Essentials", () => {
    expect(isVisibilityOptionAtModuleTier("portfolio", "ESSENTIALS")).toBe(true);
    expect(isVisibilityOptionAtModuleTier("assessmentLeads", "ESSENTIALS")).toBe(true);
    expect(isVisibilityOptionAtModuleTier("productTours", "ESSENTIALS")).toBe(true);
    expect(isVisibilityOptionAtModuleTier("hideTierLockedNav", "ESSENTIALS")).toBe(true);
    expect(isVisibilityOptionAtModuleTier("skipIntake", "ESSENTIALS")).toBe(true);
    expect(isVisibilityOptionAtModuleTier("skipPostIntakeReview", "ESSENTIALS")).toBe(true);
    expect(isVisibilityOptionAtModuleTier("documentRequirements", "ESSENTIALS")).toBe(true);
    expect(isVisibilityOptionAtModuleTier("actionPlan", "ESSENTIALS")).toBe(true);
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

  it("marks portfolio unavailable when portfolio modules are disabled platform-wide", () => {
    const state = getVisibilityOptionTierState("portfolio", "ESSENTIALS", {
      ...flags,
      riskIntelligenceEnabled: false,
      governanceDashboardEnabled: false,
    });
    expect(state.available).toBe(false);
    expect(state.lockBadge).toBe("Unavailable");
    expect(state.requiredTierLabel).toBeNull();
    expect(state.includedSummary).toContain("AKILI support");
  });

  it("marks portfolio with the required tier when analytics is gated", () => {
    const state = getVisibilityOptionTierState("portfolio", "PROFESSIONAL", {
      ...flags,
      riskIntelligenceEnabled: false,
      governanceDashboardEnabled: true,
    });
    expect(state.available).toBe(false);
    expect(state.lockBadge).toBeNull();
    expect(state.requiredTierLabel).toBe("Platinum");
    expect(state.includedSummary).toBe(
      "Requires Platinum or higher (your firm is on Professional).",
    );
    expect(minimumTierForPortfolioConfiguration({
      ...flags,
      riskIntelligenceEnabled: false,
      governanceDashboardEnabled: true,
    })).toBe("PLATINUM");
  });
});

describe("clampVisibilityToModuleTier", () => {
  it("forces unavailable toggles off before save", () => {
    expect(
      clampVisibilityToModuleTier(
        {
          portfolio: true,
          assessmentLeads: true,
          methodology: true,
          engagements: true,
          reassessment: true,
          productTours: true,
          hideTierLockedNav: true,
          skipIntake: true,
          skipPostIntakeReview: true,
          documentRequirements: true,
          actionPlan: true,
          sharedClientVisibility: true,
        },
        "ESSENTIALS",
      ),
    ).toEqual({
      portfolio: true,
      assessmentLeads: true,
      methodology: false,
      engagements: false,
      reassessment: false,
      productTours: true,
      hideTierLockedNav: true,
      skipIntake: true,
      skipPostIntakeReview: true,
      documentRequirements: true,
      actionPlan: true,
      sharedClientVisibility: true,
    });
  });
});
