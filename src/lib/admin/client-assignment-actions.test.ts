import { beforeEach, describe, expect, it, vi } from "vitest";

const CLIENT_ID = "clh7r9k2m4n6p8q0s2u4v6x8y0z2b4";
const ADVISOR_ID = "clh7r9k2m4n6p8q0s2u4v6x8y0z2b5";
const ENTERPRISE_ID = "clh7r9k2m4n6p8q0s2u4v6x8y0z2b6";

const mocks = vi.hoisted(() => ({
  requireSuperAdminRole: vi.fn(),
  userFindFirst: vi.fn(),
  advisorFindFirst: vi.fn(),
  enterpriseMembershipFindFirst: vi.fn(),
  assignmentCount: vi.fn(),
  assignmentFindUnique: vi.fn(),
  transaction: vi.fn(),
  assertEnterpriseClientNotAlreadyInFirm: vi.fn(),
  checkClientLimitForAdvisorProfile: vi.fn(),
  decryptUserEmail: vi.fn(),
  writeAudit: vi.fn(),
  createNotification: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/admin/auth", () => ({
  requireSuperAdminRole: mocks.requireSuperAdminRole,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findFirst: mocks.userFindFirst },
    advisorProfile: { findFirst: mocks.advisorFindFirst },
    enterpriseMembership: { findFirst: mocks.enterpriseMembershipFindFirst },
    clientAdvisorAssignment: {
      count: mocks.assignmentCount,
      findUnique: mocks.assignmentFindUnique,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/enterprise/firm-client-invite", () => ({
  assertEnterpriseClientNotAlreadyInFirm: mocks.assertEnterpriseClientNotAlreadyInFirm,
}));

vi.mock("@/lib/billing/subscription-service", () => ({
  checkClientLimitForAdvisorProfile: mocks.checkClientLimitForAdvisorProfile,
}));

vi.mock("@/lib/auth/user-email", () => ({
  decryptUserEmail: mocks.decryptUserEmail,
}));

vi.mock("@/lib/data/advisor", () => ({
  createNotification: mocks.createNotification,
}));

vi.mock("@/lib/audit/audit-log", () => ({
  writeAudit: mocks.writeAudit,
  AUDIT_ACTIONS: {
    CLIENT_ASSIGNMENT_ADMIN_ASSIGN: "client_assignment.admin_assign",
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { assignClientBySuperAdminAction } from "./client-assignment-actions";

describe("assignClientBySuperAdminAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSuperAdminRole.mockResolvedValue({
      userId: "admin-1",
      role: "SUPER_ADMIN",
      email: "buddy@ebilly.com",
    });
    mocks.decryptUserEmail.mockReturnValue("client@test.com");
    mocks.assignmentCount.mockResolvedValue(0);
    mocks.assertEnterpriseClientNotAlreadyInFirm.mockResolvedValue(undefined);
    mocks.checkClientLimitForAdvisorProfile.mockResolvedValue({
      canAddClient: true,
      currentCount: 0,
      limit: 10,
    });
    mocks.assignmentFindUnique.mockResolvedValue(null);
    mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        clientProfile: { upsert: vi.fn().mockResolvedValue({}) },
        clientAdvisorAssignment: {
          create: vi.fn().mockResolvedValue({ id: "assign-new" }),
        },
      };
      await fn(tx);
      return tx;
    });
    mocks.userFindFirst.mockResolvedValue({
      id: CLIENT_ID,
      name: "Test Client",
      emailCiphertext: "cipher-client",
    });
    mocks.advisorFindFirst.mockResolvedValue({
      id: ADVISOR_ID,
      firmName: "Belvedere",
      enterpriseId: null,
      user: { name: "Advisor", emailCiphertext: "cipher-advisor" },
    });
  });

  it("assigns an unassigned client to a solo advisor", async () => {
    const result = await assignClientBySuperAdminAction({
      clientId: CLIENT_ID,
      target: `advisor:${ADVISOR_ID}`,
    });

    expect(result).toEqual({ success: true });
    expect(mocks.assertEnterpriseClientNotAlreadyInFirm).toHaveBeenCalledWith(
      ADVISOR_ID,
      "client@test.com",
    );
    expect(mocks.writeAudit).toHaveBeenCalled();
    expect(mocks.createNotification).toHaveBeenCalledWith(
      ADVISOR_ID,
      "SYSTEM",
      "Client assigned by platform admin",
      expect.stringContaining("Test Client"),
      CLIENT_ID,
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/clients");
  });

  it("resolves enterprise targets to the firm owner advisor profile", async () => {
    mocks.enterpriseMembershipFindFirst.mockResolvedValue({
      advisorProfileId: ADVISOR_ID,
    });

    const result = await assignClientBySuperAdminAction({
      clientId: CLIENT_ID,
      target: `enterprise:${ENTERPRISE_ID}`,
    });

    expect(result).toEqual({ success: true });
    expect(mocks.enterpriseMembershipFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          enterpriseId: ENTERPRISE_ID,
          role: "OWNER",
          status: "ACTIVE",
        }),
      }),
    );
  });

  it("rejects clients that already have an active assignment", async () => {
    mocks.assignmentCount.mockResolvedValue(1);

    const result = await assignClientBySuperAdminAction({
      clientId: CLIENT_ID,
      target: `advisor:${ADVISOR_ID}`,
    });

    expect(result).toEqual({
      success: false,
      error: "Client already has an active advisor assignment",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns a clear error when the advisor client limit is reached", async () => {
    mocks.checkClientLimitForAdvisorProfile.mockResolvedValue({
      canAddClient: false,
      currentCount: 10,
      limit: 10,
    });

    const result = await assignClientBySuperAdminAction({
      clientId: CLIENT_ID,
      target: `advisor:${ADVISOR_ID}`,
    });

    expect(result).toEqual({
      success: false,
      error: "Advisor client limit reached (10/10)",
    });
  });
});
