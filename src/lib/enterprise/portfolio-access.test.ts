import { beforeEach, describe, expect, it, vi } from "vitest";

const billingSpies = vi.hoisted(() => ({
  resolveBillingContext: vi.fn(),
}));

const prismaSpies = vi.hoisted(() => ({
  advisorProfile: {
    findMany: vi.fn(),
  },
  clientAdvisorAssignment: {
    findFirst: vi.fn(),
  },
  advisorEnterprise: {
    findUnique: vi.fn(),
  },
}));

vi.mock("./billing-context", () => billingSpies);
vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));

import {
  findPortfolioAssignmentForClient,
  listAdvisorProfileIdsForScope,
  resolvePortfolioScope,
} from "./portfolio-access";

describe("resolvePortfolioScope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns assigned scope for solo advisor", async () => {
    billingSpies.resolveBillingContext.mockResolvedValue({
      kind: "solo",
      userId: "user-1",
      advisorProfileId: "profile-1",
      subscription: null,
    });

    await expect(resolvePortfolioScope("user-1")).resolves.toEqual({
      mode: "assigned",
      advisorProfileId: "profile-1",
      enterpriseId: null,
      role: null,
    });
  });

  it("returns firm scope for enterprise OWNER", async () => {
    billingSpies.resolveBillingContext.mockResolvedValue({
      kind: "enterprise",
      enterpriseId: "ent-1",
      role: "OWNER",
      advisorProfileId: "profile-owner",
      subscription: null,
    });

    await expect(resolvePortfolioScope("user-1")).resolves.toEqual({
      mode: "firm",
      enterpriseId: "ent-1",
      advisorProfileId: "profile-owner",
      role: "OWNER",
    });
  });

  it("returns assigned scope for enterprise ADVISOR when firm sharing is off", async () => {
    billingSpies.resolveBillingContext.mockResolvedValue({
      kind: "enterprise",
      enterpriseId: "ent-1",
      role: "ADVISOR",
      advisorProfileId: "profile-advisor",
      subscription: null,
    });
    // null → default visibility, which has sharedClientVisibility = false.
    prismaSpies.advisorEnterprise.findUnique.mockResolvedValue(null);

    await expect(resolvePortfolioScope("user-1")).resolves.toEqual({
      mode: "assigned",
      advisorProfileId: "profile-advisor",
      enterpriseId: "ent-1",
      role: "ADVISOR",
    });
  });

  it("returns firm scope for enterprise ADVISOR when firm sharing is on", async () => {
    billingSpies.resolveBillingContext.mockResolvedValue({
      kind: "enterprise",
      enterpriseId: "ent-1",
      role: "ADVISOR",
      advisorProfileId: "profile-advisor",
      subscription: null,
    });
    prismaSpies.advisorEnterprise.findUnique.mockResolvedValue({
      advisorMemberPortfolioVisible: true,
      advisorMemberAssessmentLeadsVisible: true,
      advisorMemberMethodologyVisible: true,
      advisorMemberEngagementsVisible: true,
      advisorMemberReassessmentVisible: true,
      advisorMemberProductToursVisible: true,
      advisorMemberHideTierLockedNav: false,
      advisorMemberSkipIntakeEnabled: false,
      advisorMemberSkipPostIntakeReviewEnabled: false,
      advisorMemberDocumentRequirementsEnabled: true,
      advisorMemberActionPlanEnabled: true,
      advisorMemberSharedClientVisibilityEnabled: true,
    });

    await expect(resolvePortfolioScope("user-1")).resolves.toEqual({
      mode: "firm",
      enterpriseId: "ent-1",
      advisorProfileId: "profile-advisor",
      role: "ADVISOR",
    });
  });
});

describe("listAdvisorProfileIdsForScope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only the caller profile for assigned scope", async () => {
    const ids = await listAdvisorProfileIdsForScope({
      mode: "assigned",
      advisorProfileId: "profile-1",
      enterpriseId: null,
      role: null,
    });
    expect(ids).toEqual(["profile-1"]);
    expect(prismaSpies.advisorProfile.findMany).not.toHaveBeenCalled();
  });

  it("returns all firm profiles for firm scope", async () => {
    prismaSpies.advisorProfile.findMany.mockResolvedValue([
      { id: "profile-1" },
      { id: "profile-2" },
    ]);

    const ids = await listAdvisorProfileIdsForScope({
      mode: "firm",
      enterpriseId: "ent-1",
      advisorProfileId: "profile-1",
      role: "ADMIN",
    });

    expect(ids).toEqual(["profile-1", "profile-2"]);
    expect(prismaSpies.advisorProfile.findMany).toHaveBeenCalledWith({
      where: { enterpriseId: "ent-1" },
      select: { id: true },
    });
  });
});

describe("findPortfolioAssignmentForClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects ADVISOR opening colleague client", async () => {
    prismaSpies.clientAdvisorAssignment.findFirst.mockResolvedValue(null);

    const access = await findPortfolioAssignmentForClient(
      {
        mode: "assigned",
        advisorProfileId: "profile-advisor",
        enterpriseId: "ent-1",
        role: "ADVISOR",
      },
      "client-1",
    );

    expect(access).toBeNull();
    expect(prismaSpies.clientAdvisorAssignment.findFirst).toHaveBeenCalledWith({
      where: {
        advisorId: "profile-advisor",
        clientId: "client-1",
        status: { in: ["ACTIVE"] },
      },
      select: { advisorId: true },
    });
  });

  it("allows OWNER to open client assigned to colleague", async () => {
    prismaSpies.clientAdvisorAssignment.findFirst.mockResolvedValue({
      advisorId: "profile-colleague",
    });

    const access = await findPortfolioAssignmentForClient(
      {
        mode: "firm",
        enterpriseId: "ent-1",
        advisorProfileId: "profile-owner",
        role: "OWNER",
      },
      "client-1",
    );

    expect(access).toEqual({ assignmentAdvisorProfileId: "profile-colleague" });
    expect(prismaSpies.clientAdvisorAssignment.findFirst).toHaveBeenCalledWith({
      where: {
        clientId: "client-1",
        status: { in: ["ACTIVE"] },
        advisor: { enterpriseId: "ent-1" },
      },
      select: { advisorId: true },
    });
  });
});
