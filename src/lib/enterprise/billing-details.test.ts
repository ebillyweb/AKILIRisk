import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaSpies = vi.hoisted(() => ({
  advisorEnterprise: { findUnique: vi.fn() },
  subscription: { findUnique: vi.fn() },
}));

const resolveBillingContextMock = vi.hoisted(() => vi.fn());
const countEnterpriseClientsMock = vi.hoisted(() => vi.fn());
const getEnterpriseSeatUsageMock = vi.hoisted(() => vi.fn());
const checkClientLimitMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));
vi.mock("@/lib/enterprise/billing-context", () => ({
  resolveBillingContext: resolveBillingContextMock,
}));
vi.mock("@/lib/enterprise/client-limits", () => ({
  countEnterpriseClients: countEnterpriseClientsMock,
}));
vi.mock("@/lib/enterprise/seat-reporting", () => ({
  getEnterpriseSeatUsage: getEnterpriseSeatUsageMock,
}));
vi.mock("@/lib/billing/subscription-service", () => ({
  checkClientLimitForAdvisorProfile: checkClientLimitMock,
}));

import {
  canAccessAdvisorBilling,
  getEnterpriseBillingSummary,
} from "./billing-details";

describe("canAccessAdvisorBilling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows solo advisors", async () => {
    resolveBillingContextMock.mockResolvedValue({
      kind: "solo",
      userId: "user-1",
      advisorProfileId: "profile-1",
      subscription: null,
    });
    await expect(canAccessAdvisorBilling("user-1")).resolves.toBe(true);
  });

  it("allows enterprise OWNER and ADMIN", async () => {
    resolveBillingContextMock.mockResolvedValue({
      kind: "enterprise",
      enterpriseId: "ent-1",
      role: "OWNER",
      advisorProfileId: "profile-1",
      subscription: null,
    });
    await expect(canAccessAdvisorBilling("owner-1")).resolves.toBe(true);

    resolveBillingContextMock.mockResolvedValue({
      kind: "enterprise",
      enterpriseId: "ent-1",
      role: "ADMIN",
      advisorProfileId: "profile-2",
      subscription: null,
    });
    await expect(canAccessAdvisorBilling("admin-1")).resolves.toBe(true);
  });

  it("denies enterprise ADVISOR", async () => {
    resolveBillingContextMock.mockResolvedValue({
      kind: "enterprise",
      enterpriseId: "ent-1",
      role: "ADVISOR",
      advisorProfileId: "profile-3",
      subscription: null,
    });
    await expect(canAccessAdvisorBilling("advisor-1")).resolves.toBe(false);
  });
});

describe("getEnterpriseBillingSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveBillingContextMock.mockResolvedValue({
      kind: "enterprise",
      enterpriseId: "ent-1",
      role: "OWNER",
      advisorProfileId: "profile-1",
      subscription: null,
    });
    prismaSpies.advisorEnterprise.findUnique.mockResolvedValue({
      id: "ent-1",
      name: "Acme Wealth",
      clientLimit: 100,
      perAdvisorClientLimit: 25,
      paymentMethod: "CARD",
    });
    countEnterpriseClientsMock.mockResolvedValue(42);
    getEnterpriseSeatUsageMock.mockResolvedValue({
      activeSeats: 28,
      seatLimit: 25,
      seatOverage: 3,
    });
    checkClientLimitMock.mockResolvedValue({
      currentCount: 10,
      canAddClient: true,
    });
    prismaSpies.subscription.findUnique.mockResolvedValue({
      status: "ACTIVE",
      tier: "ENTERPRISE",
      billingCycle: "ANNUAL",
      currentPeriodEnd: new Date("2027-06-01"),
      cancelAtPeriodEnd: false,
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
    });
  });

  it("loads subscription fields and seat overage for owner portal eligibility", async () => {
    const summary = await getEnterpriseBillingSummary("owner-1");
    expect(summary).toMatchObject({
      enterpriseName: "Acme Wealth",
      firmClientCount: 42,
      firmClientLimit: 100,
      perAdvisorClientLimit: 25,
      activeSeats: 28,
      seatLimit: 25,
      seatOverage: 3,
      paymentMethod: "CARD",
      canManageStripePortal: true,
    });
    expect(prismaSpies.subscription.findUnique).toHaveBeenCalledWith({
      where: { enterpriseId: "ent-1" },
      select: expect.objectContaining({ stripeCustomerId: true }),
    });
  });

  it("returns null outside enterprise context", async () => {
    resolveBillingContextMock.mockResolvedValue({
      kind: "solo",
      userId: "user-1",
      advisorProfileId: "profile-1",
      subscription: null,
    });
    await expect(getEnterpriseBillingSummary("user-1")).resolves.toBeNull();
  });
});
