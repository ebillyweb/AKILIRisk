import { describe, expect, it } from "vitest";

import {
  analyzeDowngradeCapacity,
  clientLimitUpgradeMessage,
  downgradeCapacityBannerMessage,
  isTierWithinClientCapacity,
  planTierCapacityBlockReason,
  suggestedTierForMoreClients,
} from "./client-limit";

describe("suggestedTierForMoreClients", () => {
  it("suggests Professional when on Essentials", () => {
    expect(suggestedTierForMoreClients("ESSENTIALS")).toBe("PROFESSIONAL");
  });

  it("suggests Business when on Professional", () => {
    expect(suggestedTierForMoreClients("PROFESSIONAL")).toBe("BUSINESS");
  });

  it("returns null when already on Platinum", () => {
    expect(suggestedTierForMoreClients("PLATINUM")).toBeNull();
  });
});

describe("clientLimitUpgradeMessage", () => {
  it("mentions the next tier when solo advisor is at cap", () => {
    const message = clientLimitUpgradeMessage({
      canAddClient: false,
      currentCount: 25,
      limit: 25,
      currentTier: "ESSENTIALS",
      suggestedUpgradeTier: "PROFESSIONAL",
      isEnterprise: false,
      canSelfServeUpgrade: true,
    });
    expect(message).toContain("Professional");
    expect(message).toContain("50");
  });
});

describe("plan tier capacity", () => {
  it("allows tiers that fit active clients", () => {
    expect(isTierWithinClientCapacity(50, "PROFESSIONAL")).toBe(true);
    expect(isTierWithinClientCapacity(51, "PROFESSIONAL")).toBe(false);
  });

  it("returns a downgrade block reason with excess count", () => {
    const reason = planTierCapacityBlockReason({
      currentClientCount: 75,
      targetTier: "PROFESSIONAL",
    });
    expect(reason).toContain("75");
    expect(reason).toContain("50");
    expect(reason).toContain("End 25");
    expect(reason).toContain("pipeline");
  });
});

describe("analyzeDowngradeCapacity", () => {
  it("flags blocked lower tiers with workflow counts", () => {
    const status = analyzeDowngradeCapacity({
      currentTier: "BUSINESS",
      currentClientCount: 75,
    });
    expect(status.showBanner).toBe(true);
    expect(status.nearestBlocked).toEqual({
      tier: "PROFESSIONAL",
      limit: 50,
      workflowsToEnd: 25,
    });
    expect(status.blockedTiers).toHaveLength(2);
  });

  it("returns no banner when all lower tiers fit", () => {
    const status = analyzeDowngradeCapacity({
      currentTier: "BUSINESS",
      currentClientCount: 20,
    });
    expect(status.showBanner).toBe(false);
  });

  it("builds a multi-tier banner message", () => {
    const status = analyzeDowngradeCapacity({
      currentTier: "BUSINESS",
      currentClientCount: 75,
    });
    const message = downgradeCapacityBannerMessage(status);
    expect(message).toContain("75 active clients");
    expect(message).toContain("25 workflows for Professional");
    expect(message).toContain("50 workflows for Essentials");
  });
});
