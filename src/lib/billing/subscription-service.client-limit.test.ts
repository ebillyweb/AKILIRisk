import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaSpies = vi.hoisted(() => ({
  advisorProfile: { findUnique: vi.fn() },
  clientAdvisorAssignment: { count: vi.fn() },
  subscription: { findUnique: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));
vi.mock("@/lib/billing/config", () => ({ isBillingEnabled: () => true }));

import { checkClientLimitForAdvisorProfile } from "./subscription-service";

describe("checkClientLimitForAdvisorProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaSpies.advisorProfile.findUnique.mockResolvedValue({
      userId: "user-1",
      enterpriseId: null,
    });
    prismaSpies.clientAdvisorAssignment.count.mockResolvedValue(6);
  });

  it("uses tier limits when the stored clientLimit row is stale", async () => {
    prismaSpies.subscription.findUnique.mockResolvedValue({
      tier: "ESSENTIALS",
      clientLimit: 10,
      status: "ACTIVE",
      currentPeriodEnd: new Date("2027-01-01"),
      cancelAtPeriodEnd: false,
    });

    await expect(checkClientLimitForAdvisorProfile("profile-1")).resolves.toEqual({
      canAddClient: true,
      currentCount: 6,
      limit: 25,
      status: "ACTIVE",
    });
  });
});
