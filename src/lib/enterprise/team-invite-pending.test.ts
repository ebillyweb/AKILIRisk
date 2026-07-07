import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaSpies = vi.hoisted(() => ({
  enterpriseMembership: {
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const teamAccess = vi.hoisted(() => ({
  requireEnterpriseTeamManager: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));
vi.mock("@/lib/enterprise/team-access", () => teamAccess);
vi.mock("@/lib/auth/user-email-crypto", () => ({
  decryptUserEmail: vi.fn(() => "advisor@firm.com"),
}));

import {
  resendEnterpriseTeamInvite,
  revokeEnterpriseTeamInvite,
} from "./team-invite";

const MEMBERSHIP_ID = "membership-invited";
const ACTOR_USER_ID = "owner-user";
const ENTERPRISE_ID = "ent-1";

function mockPendingInvite() {
  teamAccess.requireEnterpriseTeamManager.mockResolvedValue({
    enterpriseId: ENTERPRISE_ID,
    enterpriseName: "Northbridge Elite",
    role: "OWNER",
  });
  prismaSpies.enterpriseMembership.findFirst.mockResolvedValue({
    id: MEMBERSHIP_ID,
    status: "INVITED",
    role: "ADVISOR",
    invitedEmail: "advisor@firm.com",
    user: { emailCiphertext: "cipher" },
    enterprise: { name: "Northbridge Elite" },
  });
}

describe("pending enterprise team invites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = "test-auth-secret-for-enterprise-team-invites";
  });

  it("resends a pending invite with a fresh link", async () => {
    mockPendingInvite();
    prismaSpies.enterpriseMembership.update.mockResolvedValue({});

    const result = await resendEnterpriseTeamInvite(ACTOR_USER_ID, MEMBERSHIP_ID);

    expect(result.inviteeEmail).toBe("advisor@firm.com");
    expect(result.inviteUrl).toContain("/enterprise/join?token=");
    expect(prismaSpies.enterpriseMembership.update).toHaveBeenCalledWith({
      where: { id: MEMBERSHIP_ID },
      data: { invitedAt: expect.any(Date) },
    });
  });

  it("removes a pending invite", async () => {
    mockPendingInvite();
    prismaSpies.enterpriseMembership.delete.mockResolvedValue({});

    await revokeEnterpriseTeamInvite(ACTOR_USER_ID, MEMBERSHIP_ID);

    expect(prismaSpies.enterpriseMembership.delete).toHaveBeenCalledWith({
      where: { id: MEMBERSHIP_ID },
    });
  });

  it("rejects resend for active members", async () => {
    mockPendingInvite();
    prismaSpies.enterpriseMembership.findFirst.mockResolvedValue({
      id: MEMBERSHIP_ID,
      status: "ACTIVE",
      role: "ADVISOR",
      invitedEmail: "advisor@firm.com",
      user: { emailCiphertext: "cipher" },
      enterprise: { name: "Northbridge Elite" },
    });

    await expect(resendEnterpriseTeamInvite(ACTOR_USER_ID, MEMBERSHIP_ID)).rejects.toThrow(
      "Only pending invitations can be resent or removed."
    );
  });
});
