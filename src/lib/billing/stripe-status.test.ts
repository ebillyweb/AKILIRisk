import { describe, expect, it } from "vitest";

import { mapStripeSubscriptionStatus } from "./stripe-status";

describe("mapStripeSubscriptionStatus", () => {
  it("maps active and trialing to ACTIVE", () => {
    expect(mapStripeSubscriptionStatus("active")).toBe("ACTIVE");
    expect(mapStripeSubscriptionStatus("trialing")).toBe("ACTIVE");
  });

  it("maps past_due and unpaid", () => {
    expect(mapStripeSubscriptionStatus("past_due")).toBe("PAST_DUE");
    expect(mapStripeSubscriptionStatus("unpaid")).toBe("UNPAID");
  });

  it("maps terminal states to CANCELLED", () => {
    expect(mapStripeSubscriptionStatus("canceled")).toBe("CANCELLED");
    expect(mapStripeSubscriptionStatus("incomplete_expired")).toBe("CANCELLED");
  });

  it("maps incomplete and paused to UNPAID (fail closed)", () => {
    expect(mapStripeSubscriptionStatus("incomplete")).toBe("UNPAID");
    expect(mapStripeSubscriptionStatus("paused")).toBe("UNPAID");
  });

  it("maps unrecognized Stripe statuses to UNPAID (fail closed)", () => {
    expect(
      mapStripeSubscriptionStatus("needs_attention" as "active")
    ).toBe("UNPAID");
  });
});
