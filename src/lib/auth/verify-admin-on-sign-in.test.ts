import { beforeEach, describe, expect, it, vi } from "vitest";
import { verifyAdminEmailOnFirstSignIn } from "./verify-admin-on-sign-in";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit/audit-log";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/audit/audit-log", () => ({
  writeAudit: vi.fn(),
  AUDIT_ACTIONS: {
    ADMIN_USER_EMAIL_VERIFIED: "admin_user.email_verified",
  },
}));

describe("verifyAdminEmailOnFirstSignIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (writeAudit as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  it("sets emailVerified for a pending administrator", async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      emailVerified: null,
      emailCiphertext: "ct",
      deletedAt: null,
    });

    const verified = await verifyAdminEmailOnFirstSignIn("admin-1");

    expect(verified).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "admin-1" },
      data: { emailVerified: expect.any(Date) },
    });
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin_user.email_verified",
        entityId: "admin-1",
      })
    );
  });

  it("is a no-op when the administrator is already verified", async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      emailVerified: new Date(),
      emailCiphertext: "ct",
      deletedAt: null,
    });

    const verified = await verifyAdminEmailOnFirstSignIn("admin-1");

    expect(verified).toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("does not verify non-admin roles", async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "advisor-1",
      role: "ADVISOR",
      emailVerified: null,
      emailCiphertext: "ct",
      deletedAt: null,
    });

    const verified = await verifyAdminEmailOnFirstSignIn("advisor-1");

    expect(verified).toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
