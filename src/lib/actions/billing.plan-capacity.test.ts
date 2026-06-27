import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdvisorSessionMock = vi.hoisted(() =>
  vi.fn(async () => ({ userId: "user-1" }))
);
const getAdvisorProfileOrThrowMock = vi.hoisted(() =>
  vi.fn(async () => ({ id: "profile-1", user: { email: "advisor@test.com" } }))
);
const checkClientLimitMock = vi.hoisted(() =>
  vi.fn(async () => ({ canAddClient: false, currentCount: 75, limit: 100 }))
);
const prismaSpies = vi.hoisted(() => ({
  subscription: { findUnique: vi.fn() },
}));

vi.mock("@/lib/advisor/auth", () => ({
  requireAdvisorSession: requireAdvisorSessionMock,
  getAdvisorProfileOrThrow: getAdvisorProfileOrThrowMock,
}));
vi.mock("@/lib/billing/config", () => ({ isBillingEnabled: () => true }));
vi.mock("@/lib/billing/subscription-service", () => ({
  checkClientLimitForAdvisorProfile: checkClientLimitMock,
  reconcileAdvisorSubscriptionWithStripe: vi.fn(),
  upsertSubscriptionFromStripe: vi.fn(),
  validateCheckoutPrice: vi.fn(() => "price_test"),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));
vi.mock("@/lib/public-app-url", () => ({
  resolvePublicAppUrl: async () => "https://app.example.com",
}));
vi.mock("@/lib/stripe", () => ({ getStripe: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createCheckoutSession, switchSubscriptionPlan } from "./billing";

describe("billing plan client capacity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects checkout when active clients exceed the selected tier cap", async () => {
    const result = await createCheckoutSession({
      tier: "PROFESSIONAL",
      billingCycle: "MONTHLY",
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error).toMatch(/75 active clients/i);
    expect(result.error).toMatch(/Professional allows 50/i);
  });

  it("rejects stripe plan downgrades when active clients exceed the target tier cap", async () => {
    prismaSpies.subscription.findUnique.mockResolvedValue({
      stripeSubscriptionId: "sub_123",
      stripeCustomerId: "cus_123",
    });

    const result = await switchSubscriptionPlan({
      tier: "PROFESSIONAL",
      billingCycle: "MONTHLY",
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error).toMatch(/End 25 client workflows/i);
  });
});
