import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./config", () => ({
  isBillingEnabled: vi.fn(() => true),
}));

import { isBillingEnabled } from "./config";
import { validateTierPriceEnvConfiguration } from "./tier-price-env";

const isBillingEnabledMock = vi.mocked(isBillingEnabled);

describe("validateTierPriceEnvConfiguration", () => {
  const envSnapshot = { ...process.env };

  beforeEach(() => {
    process.env = { ...envSnapshot };
    isBillingEnabledMock.mockReturnValue(true);
  });

  afterEach(() => {
    process.env = envSnapshot;
  });

  it("returns no issues when billing is disabled", () => {
    isBillingEnabledMock.mockReturnValue(false);
    expect(validateTierPriceEnvConfiguration()).toEqual([]);
  });

  it("flags missing env keys", () => {
    delete process.env.STRIPE_PRICE_BUSINESS_MONTHLY;

    const issues = validateTierPriceEnvConfiguration();
    expect(issues.some((issue) => issue.includes("STRIPE_PRICE_BUSINESS_MONTHLY"))).toBe(
      true
    );
  });

  it("flags duplicate price IDs across tiers", () => {
    const shared = "price_shared123";
    process.env.STRIPE_PRICE_ESSENTIALS_MONTHLY = shared;
    process.env.STRIPE_PRICE_ESSENTIALS_ANNUAL = "price_essentials_annual";
    process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY = shared;
    process.env.STRIPE_PRICE_PROFESSIONAL_ANNUAL = "price_professional_annual";
    process.env.STRIPE_PRICE_BUSINESS_MONTHLY = "price_business_monthly";
    process.env.STRIPE_PRICE_BUSINESS_ANNUAL = "price_business_annual";
    process.env.STRIPE_PRICE_PLATINUM_MONTHLY = "price_platinum_monthly";
    process.env.STRIPE_PRICE_PLATINUM_ANNUAL = "price_platinum_annual";

    const issues = validateTierPriceEnvConfiguration();
    expect(
      issues.some((issue) =>
        issue.includes("STRIPE_PRICE_PROFESSIONAL_MONTHLY") &&
        issue.includes("STRIPE_PRICE_ESSENTIALS_MONTHLY")
      )
    ).toBe(true);
  });
});
