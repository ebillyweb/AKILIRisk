import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaSpies = vi.hoisted(() => ({
  enterpriseMembership: { findUnique: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));
vi.mock("@/lib/auth/user-email-crypto", () => ({
  decryptUserEmail: vi.fn(() => "member@firm.com"),
}));

import { createEnterpriseTeamInviteToken } from "./team-invite-token";
import { resolveEnterpriseTeamInvite } from "./team-invite";

const MEMBERSHIP_ID = "membership-invited";

describe("resolveEnterpriseTeamInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = "test-auth-secret-for-enterprise-team-invites";
  });

  it("returns invite context for a pending invite without credentials", async () => {
    prismaSpies.enterpriseMembership.findUnique.mockResolvedValue({
      status: "INVITED",
      invitedEmail: "member@firm.com",
      user: { password: null, emailCiphertext: "cipher" },
      enterprise: { name: "Northbridge Elite" },
    });

    const token = createEnterpriseTeamInviteToken(MEMBERSHIP_ID);
    const result = await resolveEnterpriseTeamInvite(token);

    expect(result).toEqual({
      ok: true,
      membershipId: MEMBERSHIP_ID,
      enterpriseName: "Northbridge Elite",
      inviteeEmail: "member@firm.com",
      needsRegistration: true,
    });
  });

  it("requires sign-in when the invitee already has credentials", async () => {
    prismaSpies.enterpriseMembership.findUnique.mockResolvedValue({
      status: "INVITED",
      invitedEmail: "member@firm.com",
      user: { password: "hashed", emailCiphertext: "cipher" },
      enterprise: { name: "Northbridge Elite" },
    });

    const token = createEnterpriseTeamInviteToken(MEMBERSHIP_ID);
    const result = await resolveEnterpriseTeamInvite(token);

    expect(result).toMatchObject({
      ok: true,
      needsRegistration: false,
    });
  });
});
