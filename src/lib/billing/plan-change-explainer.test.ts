import { describe, expect, it } from "vitest";

import {
  buildPlanChangeExplainer,
  resolvePlanChangeKind,
} from "./plan-change-explainer";

describe("resolvePlanChangeKind", () => {
  it("detects upgrades on active subscriptions", () => {
    expect(
      resolvePlanChangeKind({
        targetTier: "PROFESSIONAL",
        targetBillingCycle: "MONTHLY",
        committedPlan: { tier: "ESSENTIALS", billingCycle: "MONTHLY" },
        changePlanMode: "stripe_update",
        subscriptionStatus: "ACTIVE",
        currentClientCount: 10,
      }),
    ).toBe("upgrade");
  });

  it("detects billing interval switches", () => {
    expect(
      resolvePlanChangeKind({
        targetTier: "BUSINESS",
        targetBillingCycle: "ANNUAL",
        committedPlan: { tier: "BUSINESS", billingCycle: "MONTHLY" },
        changePlanMode: "stripe_update",
        subscriptionStatus: "ACTIVE",
        currentClientCount: 10,
      }),
    ).toBe("billing_switch");
  });
});

describe("buildPlanChangeExplainer", () => {
  it("explains checkout for new subscriptions", () => {
    const explainer = buildPlanChangeExplainer({
      targetTier: "ESSENTIALS",
      targetBillingCycle: "MONTHLY",
      committedPlan: null,
      changePlanMode: "checkout",
      subscriptionStatus: "NONE",
      currentClientCount: 0,
    });

    expect(explainer.kind).toBe("subscribe");
    expect(explainer.confirmLabel).toBe("Continue to checkout");
    expect(explainer.bullets.some((b) => /Stripe Checkout/i.test(b))).toBe(true);
  });

  it("warns when downgrading with too many active clients", () => {
    const explainer = buildPlanChangeExplainer({
      targetTier: "ESSENTIALS",
      targetBillingCycle: "MONTHLY",
      committedPlan: { tier: "BUSINESS", billingCycle: "MONTHLY" },
      changePlanMode: "stripe_update",
      subscriptionStatus: "ACTIVE",
      currentClientCount: 40,
    });

    expect(explainer.kind).toBe("downgrade");
    expect(explainer.warning).toMatch(/40 active clients/i);
    expect(explainer.bullets.some((b) => /lose access/i.test(b))).toBe(true);
  });

  it("lists unlocked features on upgrade", () => {
    const explainer = buildPlanChangeExplainer({
      targetTier: "PROFESSIONAL",
      targetBillingCycle: "MONTHLY",
      committedPlan: { tier: "ESSENTIALS", billingCycle: "MONTHLY" },
      changePlanMode: "stripe_update",
      subscriptionStatus: "ACTIVE",
      currentClientCount: 5,
    });

    expect(explainer.kind).toBe("upgrade");
    expect(explainer.bullets.some((b) => /Unlocks:/i.test(b))).toBe(true);
  });
});
