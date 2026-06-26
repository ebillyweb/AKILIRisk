import { describe, expect, it } from "vitest";

import {
  clientLimitUpgradeMessage,
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
