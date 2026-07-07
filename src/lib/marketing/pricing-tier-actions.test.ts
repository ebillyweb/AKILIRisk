import { describe, expect, it } from "vitest";

import {
  nextSelfServeTier,
  resolveCommittedPlan,
  resolvePricingPlanChangeMode,
  resolvePricingTierButtonLabel,
  resolvePricingTierCapacityBlock,
} from "@/lib/marketing/pricing-tier-actions";
import type { SubscriptionDetailsDTO } from "@/lib/actions/billing";

function subscription(
  overrides: Partial<SubscriptionDetailsDTO> = {},
): SubscriptionDetailsDTO {
  return {
    tier: "PROFESSIONAL",
    status: "ACTIVE",
    clientLimit: 50,
    billingCycle: "MONTHLY",
    currentPeriodEnd: new Date().toISOString(),
    cancelAtPeriodEnd: false,
    stripeCustomerId: "cus_123",
    stripeSubscriptionId: "sub_123",
    currentClientCount: 0,
    canAddClient: true,
    ...overrides,
  };
}

describe("pricing-tier-actions", () => {
  it("treats stripe-linked subscriptions as stripe_update mode", () => {
    expect(resolvePricingPlanChangeMode(subscription())).toBe("stripe_update");
    expect(resolvePricingPlanChangeMode(subscription({ stripeSubscriptionId: null }))).toBe(
      "checkout",
    );
  });

  it("resolves committed plan only when status is not NONE", () => {
    expect(resolveCommittedPlan(subscription())).toEqual({
      tier: "PROFESSIONAL",
      billingCycle: "MONTHLY",
    });
    expect(resolveCommittedPlan(subscription({ status: "NONE" }))).toBeNull();
  });

  it("labels higher tiers as Upgrade for subscribed advisors", () => {
    const committed = resolveCommittedPlan(subscription())!;
    expect(
      resolvePricingTierButtonLabel({
        tier: "BUSINESS",
        billingCycle: "MONTHLY",
        committedPlan: committed,
        subscriptionStatus: "ACTIVE",
        awaitingCheckoutOnly: false,
      }),
    ).toBe("Upgrade");
  });

  it("returns the next tier in the self-serve ladder", () => {
    expect(nextSelfServeTier("PROFESSIONAL")).toBe("BUSINESS");
    expect(nextSelfServeTier("PLATINUM")).toBeNull();
  });

  it("blocks downgrades when active clients exceed the target tier cap", () => {
    const committed = resolveCommittedPlan(subscription({ tier: "BUSINESS" }))!;
    const block = resolvePricingTierCapacityBlock({
      tier: "PROFESSIONAL",
      currentClientCount: 75,
      committedPlan: committed,
      billingCycle: "MONTHLY",
    });
    expect(block.blocked).toBe(true);
    expect(block.clientsOverLimit).toBe(25);
  });

  it("allows billing-interval switches on the same tier regardless of downgrade rules", () => {
    const committed = resolveCommittedPlan(
      subscription({ tier: "BUSINESS", billingCycle: "MONTHLY" }),
    )!;
    const block = resolvePricingTierCapacityBlock({
      tier: "BUSINESS",
      currentClientCount: 75,
      committedPlan: committed,
      billingCycle: "ANNUAL",
    });
    expect(block.blocked).toBe(false);
  });
});
