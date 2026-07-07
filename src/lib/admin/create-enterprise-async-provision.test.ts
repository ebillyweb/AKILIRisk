import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaSpies = vi.hoisted(() => ({
  user: { findFirst: vi.fn() },
  advisorEnterprise: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

const enterpriseCreate = vi.hoisted(() => vi.fn());
const scheduleProvision = vi.hoisted(() => vi.fn());
const queueProvision = vi.hoisted(() =>
  vi.fn(async () => ({ queued: true, mode: "legacy" as const })),
);
const writeAudit = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));
vi.mock("@/lib/admin/auth", () => ({
  requireAdminRole: vi.fn(async () => ({
    userId: "admin-1",
    email: "admin@test.com",
    role: "ADMIN",
  })),
}));
vi.mock("@/lib/advisor/subdomain", () => ({
  validateSubdomainFormat: vi.fn(() => ({ valid: true })),
  isSubdomainReserved: vi.fn(async () => ({ reserved: false })),
}));
vi.mock("@/lib/advisor/platform-subdomain", () => ({
  getSubdomainActivationData: vi.fn(() => ({
    isActive: true,
    dnsVerified: true,
    sslProvisioned: true,
    verifiedAt: new Date("2026-01-01"),
  })),
}));
vi.mock("@/lib/enterprise/schedule-enterprise-provision", () => ({
  scheduleEnterpriseProvision: scheduleProvision,
  queueEnterpriseProvision: queueProvision,
}));
vi.mock("@/lib/enterprise/cancel-solo-subscription", () => ({
  cancelSoloSubscriptionForEnterprise: vi.fn(async () => ({
    cancelled: true,
    stripeSubscriptionId: "sub_solo_owner",
  })),
}));
vi.mock("@/lib/audit/audit-log", () => ({
  writeAudit,
  AUDIT_ACTIONS: { USER_UPDATE: "USER_UPDATE" },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createEnterpriseByAdmin } from "./actions";

const OWNER_USER_ID = "clp8v0abc12345678901234567";
const OWNER_PROFILE_ID = "adv-owner-profile";
const ENTERPRISE_ID = "ent-new-1";

describe("createEnterpriseByAdmin — async provision", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    prismaSpies.user.findFirst.mockResolvedValue({
      id: OWNER_USER_ID,
      advisorProfile: { id: OWNER_PROFILE_ID, enterpriseId: null },
      enterpriseMembership: null,
    });
    prismaSpies.advisorEnterprise.findUnique.mockResolvedValue(null);

    enterpriseCreate.mockResolvedValue({
      id: ENTERPRISE_ID,
      name: "Belvedere Group",
      slug: "belvedere-group",
    });

    prismaSpies.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        advisorEnterprise: { create: enterpriseCreate },
        advisorProfile: { update: vi.fn() },
        enterpriseMembership: {
          create: vi.fn().mockResolvedValue({ id: "membership-owner-1" }),
        },
        subscription: {
          create: vi.fn().mockResolvedValue({ id: "sub-ent-1" }),
        },
        subscriptionAuditLog: { create: vi.fn() },
        advisorSubdomain: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
        },
      };
      return fn(tx);
    });
  });

  it("creates a PROVISIONING firm shell and schedules background finalize", async () => {
    const result = await createEnterpriseByAdmin({
      name: "Belvedere Group",
      slug: "belvedere-group",
      ownerUserId: OWNER_USER_ID,
      moduleTier: "PROFESSIONAL",
      paymentMethod: "WIRE",
    });

    expect(result.success).toBe(true);
    expect(result.queued).toBe(true);
    expect(result.enterpriseId).toBe(ENTERPRISE_ID);

    expect(enterpriseCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "PROVISIONING",
        slug: "belvedere-group",
      }),
    });

    expect(scheduleProvision).toHaveBeenCalledWith(
      ENTERPRISE_ID,
      expect.objectContaining({ userId: "admin-1" }),
    );
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        afterData: expect.objectContaining({
          status: "PROVISIONING",
          provisionSubmitted: true,
        }),
      }),
    );
  });
});
