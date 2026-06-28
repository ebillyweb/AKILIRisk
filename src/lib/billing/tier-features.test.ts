import { describe, expect, it } from "vitest";

import {
  advisorTierFeatureBillingHref,
  tierIncludesFeature,
  tierUpgradeMessage,
} from "./tier-features";

describe("tierIncludesFeature", () => {
  it("allows Professional+ for methodology customization", () => {
    expect(tierIncludesFeature("ESSENTIALS", "METHODOLOGY_CUSTOMIZATION")).toBe(false);
    expect(tierIncludesFeature("PROFESSIONAL", "METHODOLOGY_CUSTOMIZATION")).toBe(true);
    expect(tierIncludesFeature("PLATINUM", "METHODOLOGY_CUSTOMIZATION")).toBe(true);
  });

  it("allows Business+ for implementation engagements", () => {
    expect(tierIncludesFeature("PROFESSIONAL", "IMPLEMENTATION_ENGAGEMENTS")).toBe(false);
    expect(tierIncludesFeature("BUSINESS", "IMPLEMENTATION_ENGAGEMENTS")).toBe(true);
  });

  it("allows Platinum+ for portfolio analytics", () => {
    expect(tierIncludesFeature("BUSINESS", "PORTFOLIO_ANALYTICS")).toBe(false);
    expect(tierIncludesFeature("PLATINUM", "PORTFOLIO_ANALYTICS")).toBe(true);
  });
});

describe("tierUpgradeMessage", () => {
  it("names the required tier when locked", () => {
    expect(tierUpgradeMessage("METHODOLOGY_CUSTOMIZATION", "ESSENTIALS")).toContain(
      "Professional"
    );
  });
});

describe("advisorTierFeatureBillingHref", () => {
  it("deep-links billing to the minimum tier", () => {
    expect(advisorTierFeatureBillingHref("IMPLEMENTATION_ENGAGEMENTS")).toBe(
      "/advisor/billing?checkout_plan=BUSINESS&checkout_cycle=MONTHLY"
    );
  });
});
