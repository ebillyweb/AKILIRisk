import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InvitationStatus } from "@prisma/client";
import { INVITATION_TTL_SEC } from "@/lib/invite";
import { DEFAULT_INVITATION_PERSONAL_MESSAGE } from "@/lib/schemas/invitation";

const createdRows: Record<string, unknown>[] = [];

const prismaSpies = vi.hoisted(() => ({
  inviteCode: {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const row = {
        id: "invite-1",
        code: "ABC123",
        usedCount: 0,
        createdAt: new Date(),
        statusUpdatedAt: new Date(),
        resendCount: 0,
        advisor: {
          id: "adv-1",
          firmName: "Test Firm",
          user: { name: "Advisor", emailCiphertext: "cipher:advisor@test.com" },
        },
        ...data,
      };
      createdRows.push(data);
      return row;
    }),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));
vi.mock("@/lib/auth/user-email", () => ({
  decryptUserEmail: (ciphertext: string) => ciphertext.replace(/^cipher:/, ""),
}));
vi.mock("@/lib/invite", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/invite")>();
  return {
    ...actual,
    createInvitationToken: () => "signed-invite-token",
  };
});
vi.mock("@/lib/invitations/invitation-link", () => ({
  resolveInvitationLinkContext: vi.fn(async () => ({
    origin: "https://app.akilirisk.com",
    usesAdvisorSubdomain: false,
  })),
  buildInvitationSignupUrl: (
    origin: string,
    token: string,
    callback: string
  ) => `${origin}/signup?invite=${token}&callbackUrl=${encodeURIComponent(callback)}`,
}));

import { createAdvisorInvitation } from "./service";

describe("createAdvisorInvitation (US-1)", () => {
  const originalNextAuthUrl = process.env.NEXTAUTH_URL;

  beforeEach(() => {
    createdRows.length = 0;
    vi.clearAllMocks();
    process.env.NEXTAUTH_URL = "https://app.akilirisk.com";
  });

  afterEach(() => {
    process.env.NEXTAUTH_URL = originalNextAuthUrl;
  });

  it("creates a single-use invitation with SENT status and 7-day expiry", async () => {
    const before = Date.now();
    const result = await createAdvisorInvitation("advisor-profile-1", {
      clientEmail: "client@example.com",
      clientName: "Jane",
      personalMessage: DEFAULT_INVITATION_PERSONAL_MESSAGE,
      intakeWaived: false,
    });
    const after = Date.now();

    expect(prismaSpies.inviteCode.create).toHaveBeenCalledOnce();
    const data = createdRows[0] as {
      prefillEmail: string;
      maxUses: number;
      status: InvitationStatus;
      expiresAt: Date;
      intakeWaived: boolean;
      createdBy: string;
    };

    expect(data.prefillEmail).toBe("client@example.com");
    expect(data.maxUses).toBe(1);
    expect(data.status).toBe(InvitationStatus.SENT);
    expect(data.createdBy).toBe("advisor-profile-1");
    expect(data.intakeWaived).toBe(false);

    const expectedMin = before + INVITATION_TTL_SEC * 1000;
    const expectedMax = after + INVITATION_TTL_SEC * 1000;
    expect(data.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(data.expiresAt.getTime()).toBeLessThanOrEqual(expectedMax);

    expect(result.url).toContain("invite=signed-invite-token");
    expect(result.url).toContain(
      encodeURIComponent("/intake")
    );
  });

  it("routes intake-waived invitations to assessment instead of intake", async () => {
    const result = await createAdvisorInvitation("advisor-profile-1", {
      clientEmail: "client@example.com",
      intakeWaived: true,
    });

    expect(createdRows[0]).toMatchObject({ intakeWaived: true });
    expect(result.url).toContain(encodeURIComponent("/assessment"));
    expect(result.url).not.toContain(encodeURIComponent("/intake"));
  });
});
