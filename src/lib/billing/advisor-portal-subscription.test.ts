import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  hasQualifyingPaidStripeSubscription,
  isPastPaidSignupDeadline,
  paidSignupDeadlineForSubscription,
  subscriptionQualifiesForPortalEnablement,
} from "./advisor-portal-subscription";

const createdAt = new Date(Date.UTC(2026, 0, 1, 12, 0, 0));

function sub(overrides: Partial<{
  status: "GRACE_PERIOD" | "ACTIVE" | "UNPAID" | "PAST_DUE" | "CANCELLED";
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string | null;
  createdAt: Date;
}>) {
  return {
    status: "GRACE_PERIOD" as const,
    currentPeriodEnd: new Date(Date.UTC(2026, 0, 2, 0, 0, 0, 0)),
    cancelAtPeriodEnd: false,
    stripeSubscriptionId: null,
    createdAt,
    ...overrides,
  };
}

describe("paidSignupDeadlineForSubscription", () => {
  it("is 30 days after subscription createdAt", () => {
    expect(paidSignupDeadlineForSubscription({ createdAt })).toEqual(
      new Date(Date.UTC(2026, 0, 31, 12, 0, 0))
    );
  });
});

describe("isPastPaidSignupDeadline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is false before the deadline", () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 0, 15, 0, 0, 0)));
    expect(isPastPaidSignupDeadline({ createdAt })).toBe(false);
  });

  it("is true on or after the deadline", () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 0, 31, 12, 0, 0)));
    expect(isPastPaidSignupDeadline({ createdAt })).toBe(true);
  });
});

describe("hasQualifyingPaidStripeSubscription", () => {
  it("requires Stripe id and ACTIVE or PAST_DUE", () => {
    expect(
      hasQualifyingPaidStripeSubscription({
        stripeSubscriptionId: "sub_1",
        status: "ACTIVE",
      })
    ).toBe(true);
    expect(
      hasQualifyingPaidStripeSubscription({
        stripeSubscriptionId: "sub_1",
        status: "PAST_DUE",
      })
    ).toBe(true);
    expect(
      hasQualifyingPaidStripeSubscription({
        stripeSubscriptionId: "sub_1",
        status: "UNPAID",
      })
    ).toBe(false);
    expect(
      hasQualifyingPaidStripeSubscription({
        stripeSubscriptionId: null,
        status: "ACTIVE",
      })
    ).toBe(false);
  });
});

describe("subscriptionQualifiesForPortalEnablement", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows calendar grace without Stripe before period end and within 30 days", () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 0, 1, 18, 0, 0)));
    expect(
      subscriptionQualifiesForPortalEnablement(
        sub({
          currentPeriodEnd: new Date(Date.UTC(2026, 0, 2, 0, 0, 0, 0)),
        }),
        true
      )
    ).toBe(true);
  });

  it("blocks after calendar grace without qualifying Stripe", () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 0, 3, 0, 0, 0)));
    expect(
      subscriptionQualifiesForPortalEnablement(
        sub({
          currentPeriodEnd: new Date(Date.UTC(2026, 0, 2, 0, 0, 0, 0)),
        }),
        true
      )
    ).toBe(false);
  });

  it("blocks extended GRACE_PERIOD past 30-day paid signup without Stripe", () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 1, 15, 0, 0, 0)));
    expect(
      subscriptionQualifiesForPortalEnablement(
        sub({
          currentPeriodEnd: new Date(Date.UTC(2026, 1, 20, 0, 0, 0, 0)),
        }),
        true
      )
    ).toBe(false);
  });

  it("allows ACTIVE with Stripe after calendar grace", () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 2, 1, 0, 0, 0)));
    expect(
      subscriptionQualifiesForPortalEnablement(
        sub({
          status: "ACTIVE",
          stripeSubscriptionId: "sub_live",
          currentPeriodEnd: new Date(Date.UTC(2026, 3, 1, 0, 0, 0, 0)),
        }),
        true
      )
    ).toBe(true);
  });

  it("skips billing checks when billing features are disabled", () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 0, 1, 18, 0, 0)));
    expect(
      subscriptionQualifiesForPortalEnablement(
        sub({
          stripeSubscriptionId: null,
          currentPeriodEnd: new Date(Date.UTC(2026, 0, 2, 0, 0, 0, 0)),
        }),
        false
      )
    ).toBe(true);
  });
});
