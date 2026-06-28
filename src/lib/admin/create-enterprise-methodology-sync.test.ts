import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaSpies = vi.hoisted(() => ({
  user: { findFirst: vi.fn() },
  advisorEnterprise: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

const transferAssets = vi.hoisted(() => vi.fn(async () => undefined));
const syncRules = vi.hoisted(() => vi.fn(async () => ({ advisorsUpdated: 0 })));
const syncMethodology = vi.hoisted(() => vi.fn(async () => ({ advisorsUpdated: 0 })));
const cancelSolo = vi.hoisted(() =>
  vi.fn(async () => ({ stripeSubscriptionId: "sub_solo_owner" as string | null })),
);
const cancelStripe = vi.hoisted(() => vi.fn(async () => undefined));
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
vi.mock("@/lib/enterprise/transfer-advisor-assets", () => ({
  transferAdvisorAssetsToEnterprise: transferAssets,
}));
vi.mock("@/lib/methodology/clone-enterprise-defaults", () => ({
  syncEnterpriseRulesToMembers: syncRules,
}));
vi.mock("@/lib/methodology/clone-enterprise-methodology", () => ({
  syncEnterpriseMethodologyToMembers: syncMethodology,
}));
vi.mock("@/lib/enterprise/cancel-solo-subscription", () => ({
  cancelSoloSubscriptionForEnterprise: cancelSolo,
}));
vi.mock("@/lib/billing/cancel-stripe-subscription", () => ({
  cancelStripeSubscriptionBestEffort: cancelStripe,
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

describe("createEnterpriseByAdmin — methodology sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    prismaSpies.user.findFirst.mockResolvedValue({
      id: OWNER_USER_ID,
      advisorProfile: { id: OWNER_PROFILE_ID, enterpriseId: null },
      enterpriseMembership: null,
    });
    prismaSpies.advisorEnterprise.findUnique.mockResolvedValue(null);

    prismaSpies.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        advisorEnterprise: {
          create: vi.fn().mockResolvedValue({
            id: ENTERPRISE_ID,
            name: "Belvedere Group",
            slug: "belvedere-group",
          }),
        },
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

  it("transfers owner methodology into the firm and syncs members after provision", async () => {
    const result = await createEnterpriseByAdmin({
      name: "Belvedere Group",
      slug: "belvedere-group",
      ownerUserId: OWNER_USER_ID,
      moduleTier: "PROFESSIONAL",
      paymentMethod: "WIRE",
    });

    expect(result.success).toBe(true);
    expect(result.enterpriseId).toBe(ENTERPRISE_ID);
    expect(transferAssets).toHaveBeenCalledWith(
      expect.anything(),
      OWNER_PROFILE_ID,
      ENTERPRISE_ID,
    );
    expect(syncRules).toHaveBeenCalledWith(ENTERPRISE_ID);
    expect(syncMethodology).toHaveBeenCalledWith(ENTERPRISE_ID);
    expect(cancelStripe).toHaveBeenCalledWith("sub_solo_owner");
    expect(writeAudit).toHaveBeenCalled();
  });
});
