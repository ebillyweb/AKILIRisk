import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaSpies = vi.hoisted(() => ({
  enterpriseMembership: { findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}));

const transferAssets = vi.hoisted(() => vi.fn(async () => undefined));
const provisionMemberContent = vi.hoisted(() => vi.fn(async () => undefined));
const syncRules = vi.hoisted(() => vi.fn(async () => ({ advisorsUpdated: 0 })));
const syncMethodology = vi.hoisted(() => vi.fn(async () => ({ advisorsUpdated: 0 })));
const cancelSolo = vi.hoisted(() =>
  vi.fn(async () => ({ stripeSubscriptionId: "sub_solo_1" as string | null })),
);
const cancelStripe = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));
vi.mock("@/lib/enterprise/transfer-advisor-assets", () => ({
  transferAdvisorAssetsToEnterprise: transferAssets,
}));
vi.mock("@/lib/enterprise/provision-team-member-content", () => ({
  provisionEnterpriseTeamMemberContent: provisionMemberContent,
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

import { acceptEnterpriseTeamInvite } from "./team-invite";

const MEMBERSHIP_ID = "membership-1";
const USER_ID = "user-admin-1";
const ENTERPRISE_ID = "ent-1";
const PROFILE_ID = "adv-profile-1";

function mockAcceptTransaction(role: "ADMIN" | "ADVISOR") {
  prismaSpies.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
    await fn({
      advisorProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: PROFILE_ID, enterpriseId: null }),
        create: vi.fn(),
        update: vi.fn(),
      },
      enterpriseMembership: { update: vi.fn() },
    });
  });

  prismaSpies.enterpriseMembership.findUnique.mockResolvedValue({
    id: MEMBERSHIP_ID,
    status: "INVITED",
    userId: USER_ID,
    enterpriseId: ENTERPRISE_ID,
    role,
    enterprise: { id: ENTERPRISE_ID, name: "Belvedere Wealth" },
    user: { id: USER_ID, emailCiphertext: "cipher" },
  });
}

describe("acceptEnterpriseTeamInvite — methodology sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("transfers advisor assets and syncs firm methodology when an ADMIN accepts", async () => {
    mockAcceptTransaction("ADMIN");

    const result = await acceptEnterpriseTeamInvite(MEMBERSHIP_ID, USER_ID);

    expect(result).toEqual({
      enterpriseId: ENTERPRISE_ID,
      enterpriseName: "Belvedere Wealth",
    });
    expect(transferAssets).toHaveBeenCalledWith(
      expect.anything(),
      PROFILE_ID,
      ENTERPRISE_ID,
    );
    expect(provisionMemberContent).toHaveBeenCalledWith(ENTERPRISE_ID, PROFILE_ID);
    expect(syncRules).not.toHaveBeenCalled();
    expect(syncMethodology).not.toHaveBeenCalled();
    expect(cancelStripe).toHaveBeenCalledWith("sub_solo_1");
  });

  it("syncs firm methodology to ADVISOR members without transferring personal assets", async () => {
    mockAcceptTransaction("ADVISOR");

    await acceptEnterpriseTeamInvite(MEMBERSHIP_ID, USER_ID);

    expect(transferAssets).not.toHaveBeenCalled();
    expect(provisionMemberContent).toHaveBeenCalledWith(ENTERPRISE_ID, PROFILE_ID);
    expect(syncRules).not.toHaveBeenCalled();
    expect(syncMethodology).not.toHaveBeenCalled();
  });
});
