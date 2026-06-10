import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdvisorSessionMock = vi.hoisted(() =>
  vi.fn(async () => ({ userId: "user-1" }))
);
const getAdvisorProfileOrThrowMock = vi.hoisted(() => vi.fn(async () => ({ id: "profile-1" })));
const resolveBillingContextMock = vi.hoisted(() => vi.fn());
const prismaSpies = vi.hoisted(() => ({
  subscription: { findUnique: vi.fn() },
  advisorEnterprise: { findUnique: vi.fn() },
}));
const stripePortalCreateMock = vi.hoisted(() =>
  vi.fn(async () => ({ url: "https://billing.stripe.com/session/test" }))
);
const getStripeMock = vi.hoisted(() =>
  vi.fn(() => ({
    billingPortal: {
      sessions: { create: stripePortalCreateMock },
    },
  }))
);

vi.mock("@/lib/advisor/auth", () => ({
  requireAdvisorSession: requireAdvisorSessionMock,
  getAdvisorProfileOrThrow: getAdvisorProfileOrThrowMock,
}));
vi.mock("@/lib/enterprise/billing-context", () => ({
  resolveBillingContext: resolveBillingContextMock,
}));
vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));
vi.mock("@/lib/billing/config", () => ({ isBillingEnabled: () => true }));
vi.mock("@/lib/public-app-url", () => ({
  resolvePublicAppUrl: async () => "https://app.example.com",
}));
vi.mock("@/lib/stripe", () => ({ getStripe: getStripeMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createPortalSession } from "./billing";

describe("createPortalSession enterprise access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects enterprise ADMIN", async () => {
    resolveBillingContextMock.mockResolvedValue({
      kind: "enterprise",
      enterpriseId: "ent-1",
      role: "ADMIN",
      advisorProfileId: "profile-1",
      subscription: null,
    });

    const result = await createPortalSession();
    expect(result).toEqual({
      success: false,
      error: "Only the firm owner can open the Stripe billing portal.",
    });
  });

  it("rejects wire-billed enterprise even for OWNER", async () => {
    resolveBillingContextMock.mockResolvedValue({
      kind: "enterprise",
      enterpriseId: "ent-1",
      role: "OWNER",
      advisorProfileId: "profile-1",
      subscription: null,
    });
    prismaSpies.advisorEnterprise.findUnique.mockResolvedValue({
      paymentMethod: "WIRE",
      subscription: { stripeCustomerId: null },
    });

    const result = await createPortalSession();
    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error).toMatch(/wire transfer/i);
  });

  it("creates portal session for enterprise OWNER with card billing", async () => {
    resolveBillingContextMock.mockResolvedValue({
      kind: "enterprise",
      enterpriseId: "ent-1",
      role: "OWNER",
      advisorProfileId: "profile-1",
      subscription: null,
    });
    prismaSpies.advisorEnterprise.findUnique.mockResolvedValue({
      paymentMethod: "CARD",
      subscription: { stripeCustomerId: "cus_ent_1" },
    });

    const result = await createPortalSession();
    expect(result).toEqual({
      success: true,
      url: "https://billing.stripe.com/session/test",
    });
    expect(stripePortalCreateMock).toHaveBeenCalledWith({
      customer: "cus_ent_1",
      return_url: "https://app.example.com/advisor/billing",
    });
  });
});
