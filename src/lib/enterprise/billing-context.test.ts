import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaSpies = vi.hoisted(() => ({
  advisorProfile: {
    findUnique: vi.fn(),
  },
  enterpriseMembership: {
    findFirst: vi.fn(),
  },
  subscription: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));

import {
  resolveBillingContext,
  subscriptionForPortalFromContext,
} from "./billing-context";

describe("resolveBillingContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when advisor profile is missing", async () => {
    prismaSpies.advisorProfile.findUnique.mockResolvedValue(null);
    await expect(resolveBillingContext("user-1")).resolves.toBeNull();
  });

  it("returns solo context for advisor without membership", async () => {
    prismaSpies.advisorProfile.findUnique.mockResolvedValue({ id: "profile-1" });
    prismaSpies.enterpriseMembership.findFirst.mockResolvedValue(null);
    prismaSpies.subscription.findUnique.mockResolvedValue({
      status: "ACTIVE",
      currentPeriodEnd: new Date("2027-01-01"),
      cancelAtPeriodEnd: false,
      stripeSubscriptionId: "sub_1",
      createdAt: new Date("2026-01-01"),
      tier: "PROFESSIONAL",
      clientLimit: 50,
    });

    const ctx = await resolveBillingContext("user-1");
    expect(ctx).toEqual({
      kind: "solo",
      userId: "user-1",
      advisorProfileId: "profile-1",
      subscription: expect.objectContaining({ tier: "PROFESSIONAL" }),
    });
  });

  it("returns enterprise context for active member", async () => {
    prismaSpies.advisorProfile.findUnique.mockResolvedValue({ id: "profile-1" });
    prismaSpies.enterpriseMembership.findFirst.mockResolvedValue({
      role: "ADVISOR",
      enterprise: {
        id: "ent-1",
        subscription: {
          status: "ACTIVE",
          currentPeriodEnd: new Date("2027-01-01"),
          cancelAtPeriodEnd: false,
          stripeSubscriptionId: null,
          createdAt: new Date("2026-01-01"),
          tier: "ENTERPRISE",
          clientLimit: 100,
        },
      },
    });

    const ctx = await resolveBillingContext("user-1");
    expect(ctx).toMatchObject({
      kind: "enterprise",
      enterpriseId: "ent-1",
      role: "ADVISOR",
      advisorProfileId: "profile-1",
    });
    expect(prismaSpies.subscription.findUnique).not.toHaveBeenCalled();
  });
});

describe("subscriptionForPortalFromContext", () => {
  it("maps subscription snapshot for portal checks", () => {
    const createdAt = new Date("2026-01-01");
    const currentPeriodEnd = new Date("2027-01-01");
    const snapshot = subscriptionForPortalFromContext({
      kind: "solo",
      userId: "u1",
      advisorProfileId: "p1",
      subscription: {
        status: "ACTIVE",
        currentPeriodEnd,
        cancelAtPeriodEnd: false,
        stripeSubscriptionId: "sub_1",
        createdAt,
        tier: "BUSINESS",
        clientLimit: 100,
      },
    });
    expect(snapshot).toEqual({
      status: "ACTIVE",
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
      stripeSubscriptionId: "sub_1",
      createdAt,
    });
  });
});
