import { describe, it, expect, vi, beforeEach } from "vitest";
import { InvitationStatus } from "@prisma/client";

const { prismaSpies } = vi.hoisted(() => ({
  prismaSpies: {
    inviteCode: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      create: vi.fn(),
    },
    clientProfile: {
      create: vi.fn(),
      upsert: vi.fn(),
    },
    clientAdvisorAssignment: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));

vi.mock("@/lib/auth/user-email", () => ({
  findUserByEmail: vi.fn(),
  userEmailWriteData: vi.fn((email: string) => ({ emailCiphertext: `cipher:${email}` })),
}));

import { findUserByEmail } from "@/lib/auth/user-email";
import { provisionClientFromInviteCode } from "./provision-client";

beforeEach(() => {
  process.env.ENCRYPTION_KEY = "test-key-do-not-use-in-prod-0123456789ABCDEF";
  vi.clearAllMocks();
  prismaSpies.$transaction.mockImplementation(async (fn: (tx: typeof prismaSpies) => unknown) =>
    fn(prismaSpies),
  );
});

describe("provisionClientFromInviteCode", () => {
  it("rejects expired invitations", async () => {
    prismaSpies.inviteCode.findUnique.mockResolvedValue({
      id: "ic-1",
      prefillEmail: "client@example.com",
      expiresAt: new Date(Date.now() - 1000),
      maxUses: 1,
      usedCount: 0,
      createdBy: "adv-1",
      clientName: "Pat Client",
      status: InvitationStatus.SENT,
    });

    const result = await provisionClientFromInviteCode("ic-1", "client@example.com");
    expect(result).toEqual({
      ok: false,
      error: "This invitation has expired.",
      code: "expired",
    });
  });

  it("creates a client user and links to the advisor", async () => {
    prismaSpies.inviteCode.findUnique.mockResolvedValue({
      id: "ic-1",
      prefillEmail: "client@example.com",
      expiresAt: null,
      maxUses: 1,
      usedCount: 0,
      createdBy: "adv-1",
      clientName: "Pat Client",
      status: InvitationStatus.OPENED,
    });
    vi.mocked(findUserByEmail).mockResolvedValue(null);
    prismaSpies.user.create.mockResolvedValue({ id: "user-1" });

    const result = await provisionClientFromInviteCode("ic-1", "client@example.com");

    expect(result).toEqual({ ok: true, userId: "user-1", created: true });
    expect(prismaSpies.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: "USER",
          password: null,
          name: "Pat Client",
        }),
      }),
    );
    expect(prismaSpies.clientAdvisorAssignment.create).toHaveBeenCalled();
  });

  it("allows an existing client to reuse an exhausted invite", async () => {
    prismaSpies.inviteCode.findUnique.mockResolvedValue({
      id: "ic-1",
      prefillEmail: "client@example.com",
      expiresAt: null,
      maxUses: 1,
      usedCount: 1,
      createdBy: "adv-1",
      clientName: null,
      status: InvitationStatus.REGISTERED,
    });
    vi.mocked(findUserByEmail).mockResolvedValue({
      id: "user-1",
      role: "USER",
    } as Awaited<ReturnType<typeof findUserByEmail>>);
    prismaSpies.clientAdvisorAssignment.findFirst.mockResolvedValue({ id: "asg-1" });

    const result = await provisionClientFromInviteCode("ic-1", "client@example.com");

    expect(result).toEqual({ ok: true, userId: "user-1", created: false });
    expect(prismaSpies.user.create).not.toHaveBeenCalled();
  });
});
