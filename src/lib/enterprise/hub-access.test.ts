import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaSpies = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  enterpriseMembership: { findUnique: vi.fn(), findFirst: vi.fn() },
  advisorProfile: { findUnique: vi.fn() },
  subscription: { findUnique: vi.fn() },
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/auth/require-mfa-verified", () => ({ assertMfaVerified: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));
vi.mock("@/lib/billing/config", () => ({ isBillingEnabled: () => false }));
vi.mock("@/lib/enterprise/billing-context", () => ({
  resolveBillingContext: vi.fn(async () => ({
    kind: "enterprise",
    enterpriseId: "ent-1",
    role: "ADVISOR",
    advisorProfileId: "profile-1",
    subscription: {
      status: "ACTIVE",
      currentPeriodEnd: new Date("2027-01-01"),
      cancelAtPeriodEnd: false,
      stripeSubscriptionId: null,
      createdAt: new Date("2026-01-01"),
    },
  })),
  subscriptionForPortalFromContext: vi.fn((ctx: { subscription: unknown }) => ctx.subscription),
}));

import { getAdvisorHubAccessForUserId } from "@/lib/advisor/auth";

describe("getAdvisorHubAccessForUserId — enterprise suspended", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "development");
  });

  it("denies hub access when membership is SUSPENDED", async () => {
    prismaSpies.user.findUnique.mockResolvedValue({
      role: "ADVISOR",
      deletedAt: null,
      advisorPortalAccessEnabled: true,
    });
    prismaSpies.enterpriseMembership.findUnique.mockResolvedValue({
      status: "SUSPENDED",
      enterprise: { status: "ACTIVE" },
    });

    const result = await getAdvisorHubAccessForUserId("user-1");
    expect(result).toEqual({ allowed: false, blockReason: "suspended" });
  });

  it("denies hub access while firm is PROVISIONING", async () => {
    prismaSpies.user.findUnique.mockResolvedValue({
      role: "ADVISOR",
      deletedAt: null,
      advisorPortalAccessEnabled: true,
    });
    prismaSpies.enterpriseMembership.findUnique.mockResolvedValue({
      status: "ACTIVE",
      enterprise: { status: "PROVISIONING" },
    });

    const result = await getAdvisorHubAccessForUserId("user-1");
    expect(result).toEqual({ allowed: false, blockReason: "provisioning" });
  });
});
