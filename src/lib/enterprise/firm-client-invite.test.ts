import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaSpies = vi.hoisted(() => ({
  advisorProfile: {
    findUnique: vi.fn(),
  },
  clientAdvisorAssignment: {
    findFirst: vi.fn(),
  },
}));

const emailSpies = vi.hoisted(() => ({
  findUserByEmail: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));
vi.mock("@/lib/auth/user-email", () => emailSpies);

import { DuplicateInvitationError } from "@/lib/invitations/service";
import {
  assertEnterpriseClientNotAlreadyInFirm,
  ENTERPRISE_CLIENT_ALREADY_IN_FIRM_MESSAGE,
} from "./firm-client-invite";

describe("assertEnterpriseClientNotAlreadyInFirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no-ops for solo advisor without enterprise", async () => {
    prismaSpies.advisorProfile.findUnique.mockResolvedValue({ enterpriseId: null });

    await expect(
      assertEnterpriseClientNotAlreadyInFirm("profile-1", "client@example.com"),
    ).resolves.toBeUndefined();

    expect(emailSpies.findUserByEmail).not.toHaveBeenCalled();
  });

  it("throws when client already has ACTIVE assignment in firm", async () => {
    prismaSpies.advisorProfile.findUnique.mockResolvedValue({ enterpriseId: "ent-1" });
    emailSpies.findUserByEmail.mockResolvedValue({ id: "client-1" });
    prismaSpies.clientAdvisorAssignment.findFirst.mockResolvedValue({ id: "assign-1" });

    await expect(
      assertEnterpriseClientNotAlreadyInFirm("profile-1", "client@example.com"),
    ).rejects.toThrow(DuplicateInvitationError);

    await expect(
      assertEnterpriseClientNotAlreadyInFirm("profile-1", "client@example.com"),
    ).rejects.toThrow(ENTERPRISE_CLIENT_ALREADY_IN_FIRM_MESSAGE);
  });

  it("allows invite when client is not yet in firm", async () => {
    prismaSpies.advisorProfile.findUnique.mockResolvedValue({ enterpriseId: "ent-1" });
    emailSpies.findUserByEmail.mockResolvedValue({ id: "client-1" });
    prismaSpies.clientAdvisorAssignment.findFirst.mockResolvedValue(null);

    await expect(
      assertEnterpriseClientNotAlreadyInFirm("profile-1", "newclient@example.com"),
    ).resolves.toBeUndefined();
  });
});
