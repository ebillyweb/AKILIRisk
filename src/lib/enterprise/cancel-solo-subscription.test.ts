import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaSpies = vi.hoisted(() => ({
  subscription: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  subscriptionAuditLog: { create: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));

import { cancelSoloSubscriptionForEnterprise } from "./cancel-solo-subscription";

describe("cancelSoloSubscriptionForEnterprise", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no-ops when the user has no solo subscription", async () => {
    prismaSpies.subscription.findUnique.mockResolvedValue(null);

    const result = await cancelSoloSubscriptionForEnterprise("user-1", {
      reason: "enterprise_team_join",
      enterpriseId: "ent-1",
    });

    expect(result.cancelled).toBe(false);
    expect(prismaSpies.subscription.update).not.toHaveBeenCalled();
  });

  it("cancels an active grace-period solo subscription", async () => {
    prismaSpies.subscription.findUnique.mockResolvedValue({
      id: "sub-1",
      status: "GRACE_PERIOD",
      stripeSubscriptionId: null,
    });

    const result = await cancelSoloSubscriptionForEnterprise("user-1", {
      reason: "enterprise_owner_provision",
      enterpriseId: "ent-1",
    });

    expect(result.cancelled).toBe(true);
    expect(prismaSpies.subscription.update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { status: "CANCELLED", cancelAtPeriodEnd: false },
    });
    expect(prismaSpies.subscriptionAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        subscriptionId: "sub-1",
        action: "solo_cancel_enterprise_owner_provision",
      }),
    });
  });

  it("returns stripe id for post-commit cancellation", async () => {
    prismaSpies.subscription.findUnique.mockResolvedValue({
      id: "sub-2",
      status: "ACTIVE",
      stripeSubscriptionId: "sub_stripe_123",
    });

    const result = await cancelSoloSubscriptionForEnterprise("user-2", {
      reason: "enterprise_team_join",
    });

    expect(result.stripeSubscriptionId).toBe("sub_stripe_123");
  });
});
