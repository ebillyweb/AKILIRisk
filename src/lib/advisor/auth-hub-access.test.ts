import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaSpies = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  enterpriseMembership: { findUnique: vi.fn() },
}));

const resolveBillingContextMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/auth/require-mfa-verified", () => ({ assertMfaVerified: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));
vi.mock("@/lib/billing/config", () => ({ isBillingEnabled: () => true }));
vi.mock("@/lib/enterprise/billing-context", () => ({
  resolveBillingContext: resolveBillingContextMock,
  subscriptionForPortalFromContext: vi.fn((ctx: { subscription: unknown }) => ctx.subscription),
}));

import { getAdvisorHubAccessForUserId } from "./auth";

describe("getAdvisorHubAccessForUserId — enterprise subscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaSpies.user.findUnique.mockResolvedValue({
      role: "ADVISOR",
      deletedAt: null,
      advisorPortalAccessEnabled: true,
    });
    prismaSpies.enterpriseMembership.findUnique.mockResolvedValue({
      status: "ACTIVE",
      enterprise: { status: "ACTIVE" },
    });
  });

  it("allows enterprise ADMIN without Stripe when firm subscription is ACTIVE", async () => {
    resolveBillingContextMock.mockResolvedValue({
      kind: "enterprise",
      enterpriseId: "ent-1",
      role: "ADMIN",
      advisorProfileId: "profile-1",
      subscription: {
        status: "ACTIVE",
        currentPeriodEnd: new Date("2027-01-01"),
        cancelAtPeriodEnd: false,
        stripeSubscriptionId: null,
        createdAt: new Date("2026-01-01"),
        tier: "ENTERPRISE",
        clientLimit: 100,
      },
    });

    await expect(getAdvisorHubAccessForUserId("user-1")).resolves.toEqual({
      allowed: true,
      blockReason: null,
    });
  });

  it("still blocks solo advisor ACTIVE without Stripe when billing is on", async () => {
    resolveBillingContextMock.mockResolvedValue({
      kind: "solo",
      userId: "user-1",
      advisorProfileId: "profile-1",
      subscription: {
        status: "ACTIVE",
        currentPeriodEnd: new Date("2027-01-01"),
        cancelAtPeriodEnd: false,
        stripeSubscriptionId: null,
        createdAt: new Date("2026-01-01"),
        tier: "STARTER",
        clientLimit: 25,
      },
    });

    await expect(getAdvisorHubAccessForUserId("user-1")).resolves.toEqual({
      allowed: false,
      blockReason: "subscription",
    });
  });
});
