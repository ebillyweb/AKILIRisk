import { describe, expect, it } from "vitest";

import { getAdminAdvisorHubDisplay } from "./advisor-hub-display";

describe("getAdminAdvisorHubDisplay", () => {
  it("flags expired grace as subscribe required", () => {
    const display = getAdminAdvisorHubDisplay({
      deletedAt: null,
      advisorPortalAccessEnabled: true,
      billingEnabled: true,
      subscription: {
        status: "GRACE_PERIOD",
        tier: "PROFESSIONAL",
        billingCycle: "MONTHLY",
        currentPeriodEnd: "2026-05-27T00:00:00.000Z",
        cancelAtPeriodEnd: false,
        stripeSubscriptionId: null,
        createdAt: "2026-05-26T17:18:29.330Z",
      },
    });

    expect(display.hubAllowed).toBe(false);
    expect(display.needsAttention).toBe(true);
    expect(display.hubLabel).toBe("Grace expired");
    expect(display.subscriptionStatusLabel).toBe("Grace expired");
  });

  it("shows grace access while period end is in the future", () => {
    const display = getAdminAdvisorHubDisplay({
      deletedAt: null,
      advisorPortalAccessEnabled: true,
      billingEnabled: true,
      subscription: {
        status: "GRACE_PERIOD",
        currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        cancelAtPeriodEnd: false,
        stripeSubscriptionId: null,
        createdAt: new Date().toISOString(),
      },
    });

    expect(display.hubAllowed).toBe(true);
    expect(display.needsAttention).toBe(false);
    expect(display.hubLabel).toBe("Grace access");
    expect(display.subscriptionStatusLabel).toBe("Grace period");
  });

  it("flags missing subscription", () => {
    const display = getAdminAdvisorHubDisplay({
      deletedAt: null,
      advisorPortalAccessEnabled: true,
      billingEnabled: true,
      subscription: null,
    });

    expect(display.hubLabel).toBe("Subscribe required");
    expect(display.subscriptionStatusLabel).toBe("No subscription");
    expect(display.needsAttention).toBe(true);
  });
});
