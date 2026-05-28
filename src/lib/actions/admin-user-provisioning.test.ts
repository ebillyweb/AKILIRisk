import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  createAdminUser,
  updateAdminUser,
  deactivateAdminUser,
  getAdminUsers,
  promoteAdminUserToSuperAdmin,
} from "./admin-user-provisioning";
import { prisma } from "@/lib/db";
import { requireSuperAdminRole } from "@/lib/admin/auth";
import { sendAdminInvitationEmail } from "@/lib/email/admin-invitation";
import bcrypt from "bcryptjs";
import { writeAudit } from "@/lib/audit/audit-log";
import { findUserByEmail } from "@/lib/auth/user-email";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/admin/auth", () => ({
  requireSuperAdminRole: vi.fn(),
}));

vi.mock("@/lib/email/admin-invitation", () => ({
  sendAdminInvitationEmail: vi.fn(),
}));

vi.mock("@/lib/audit/audit-log", () => ({
  writeAudit: vi.fn(),
  AUDIT_ACTIONS: {
    ADMIN_USER_CREATED: "admin_user.created",
    ADMIN_USER_UPDATED: "admin_user.updated",
    ADMIN_USER_DEACTIVATED: "admin_user.deactivated",
  },
}));

vi.mock("@/lib/auth/user-email", () => ({
  findUserByEmail: vi.fn(),
  userEmailWriteData: vi.fn().mockReturnValue({
    emailCiphertext: "encrypted_email",
  }),
  userEmailForDisplay: vi.fn().mockReturnValue("test@example.com"),
  withDecryptedEmail: vi.fn().mockImplementation((user) => ({
    ...user,
    email: "test@example.com",
  })),
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockAdminContext = {
  userId: "admin-123",
  email: "admin@test.com",
  role: "SUPER_ADMIN",
};

describe("Admin User Provisioning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireSuperAdminRole as any).mockResolvedValue(mockAdminContext);
    (findUserByEmail as any).mockResolvedValue(null);
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (prisma.user.create as any).mockResolvedValue({});
    (prisma.user.update as any).mockResolvedValue({});
    (prisma.user.findMany as any).mockResolvedValue([]);
    // Don't set global mock for count - let each test set it explicitly
    (bcrypt.hash as any).mockResolvedValue("hashed_password");
    (sendAdminInvitationEmail as any).mockResolvedValue({ success: true });
    (writeAudit as any).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createAdminUser", () => {
    const validInput = {
      email: "newadmin@test.com",
      name: "New Admin",
      role: "ADMIN" as const,
      sendInvitation: true,
    };

    it("should create an invited admin as pending until first sign-in", async () => {
      const mockCreatedUser = {
        id: "user-123",
        name: "New Admin",
        role: "ADMIN",
        emailCiphertext: "encrypted_email",
      };

      (findUserByEmail as any).mockResolvedValue(null); // No existing user
      (bcrypt.hash as any).mockResolvedValue("hashed_password");
      (prisma.user.create as any).mockResolvedValue(mockCreatedUser);
      (sendAdminInvitationEmail as any).mockResolvedValue({ success: true });

      const result = await createAdminUser(validInput);

      expect(result.success).toBe(true);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "New Admin",
          role: "ADMIN",
          password: "hashed_password",
          emailVerified: null,
          emailCiphertext: "encrypted_email",
        }),
      });

      // Verify audit log
      expect(writeAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: {
            userId: "admin-123",
            email: "admin@test.com",
            role: "SUPER_ADMIN",
          },
          action: "admin_user.created",
        })
      );
    });

    it("should reactivate deleted user as pending when invitation is sent", async () => {
      const existingDeletedUser = {
        id: "user-123",
        deletedAt: new Date(),
        role: "USER",
      };

      const mockUpdatedUser = {
        id: "user-123",
        name: "Reactivated Admin",
        role: "ADMIN",
      };

      (findUserByEmail as any).mockResolvedValue(existingDeletedUser);
      (bcrypt.hash as any).mockResolvedValue("hashed_password");
      (prisma.user.update as any).mockResolvedValue(mockUpdatedUser);
      (sendAdminInvitationEmail as any).mockResolvedValue({ success: true });

      const result = await createAdminUser(validInput);

      expect(result.success).toBe(true);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-123" },
        data: expect.objectContaining({
          name: "New Admin",
          role: "ADMIN",
          password: "hashed_password",
          deletedAt: null,
          emailVerified: null,
          updatedAt: expect.any(Date),
        }),
      });
    });

    it("should verify immediately when invitation email is not sent", async () => {
      const mockCreatedUser = {
        id: "user-123",
        name: "New Admin",
        role: "ADMIN",
      };

      (findUserByEmail as any).mockResolvedValue(null);
      (prisma.user.create as any).mockResolvedValue(mockCreatedUser);

      await createAdminUser({ ...validInput, sendInvitation: false });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          emailVerified: expect.any(Date),
        }),
      });
      expect(sendAdminInvitationEmail).not.toHaveBeenCalled();
    });

    it("should handle invitation email failures gracefully", async () => {
      const mockCreatedUser = {
        id: "user-123",
        name: "New Admin",
        role: "ADMIN",
      };

      (findUserByEmail as any).mockResolvedValue(null);
      (bcrypt.hash as any).mockResolvedValue("hashed_password");
      (prisma.user.create as any).mockResolvedValue(mockCreatedUser);
      (sendAdminInvitationEmail as any).mockResolvedValue({ success: false, error: "Email failed" });

      const result = await createAdminUser(validInput);

      expect(result.success).toBe(true);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          emailVerified: null,
        }),
      });
    });

    it("should reject invalid input", async () => {
      const invalidInput = {
        email: "invalid-email",
        name: "",
        role: "INVALID_ROLE" as any,
        sendInvitation: true,
      };

      const result = await createAdminUser(invalidInput);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/valid email address|Name is required|Please select a role/);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it("should prevent duplicate email addresses", async () => {
      const existingUser = {
        id: "existing-123",
        deletedAt: null,
        role: "ADMIN",
      };

      (findUserByEmail as any).mockResolvedValue(existingUser);

      const result = await createAdminUser(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain("already exists");
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe("updateAdminUser", () => {
    it("should prevent self-demotion when last super admin", async () => {
      const currentUser = {
        id: "admin-123", // Same as admin context userId
        emailCiphertext: "encrypted",
        name: "Admin",
        role: "SUPER_ADMIN",
        deletedAt: null,
      };

      (prisma.user.findUnique as any).mockResolvedValue(currentUser);
      (prisma.user.count as any).mockResolvedValue(0); // No other super admins

      const result = await updateAdminUser({
        id: "admin-123",
        role: "ADMIN", // Trying to demote
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot demote the last super admin");
    });

    it("should allow self-demotion when other super admins exist", async () => {
      const currentUser = {
        id: "admin-123",
        emailCiphertext: "encrypted",
        name: "Admin",
        role: "SUPER_ADMIN",
        deletedAt: null,
      };

      const updatedUser = {
        id: "admin-123",
        emailCiphertext: "encrypted",
        name: "Admin",
        role: "ADMIN",
      };

      (prisma.user.findUnique as any).mockResolvedValueOnce(currentUser);
      (prisma.user.count as any).mockResolvedValueOnce(1); // Other super admin exists
      (prisma.user.update as any).mockResolvedValueOnce(updatedUser);

      const updateInput = {
        id: "admin-123",
        role: "ADMIN" as const,
      };

      const result = await updateAdminUser(updateInput);

      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "admin-123" },
        data: expect.objectContaining({
          role: "ADMIN",
          updatedAt: expect.any(Date),
        }),
      });
    });
  });

  describe("promoteAdminUserToSuperAdmin", () => {
    it("promotes an ADMIN to SUPER_ADMIN", async () => {
      const adminUser = {
        id: "user-admin",
        emailCiphertext: "encrypted",
        name: "Admin",
        role: "ADMIN",
        deletedAt: null,
      };

      const promotedUser = {
        id: "user-admin",
        emailCiphertext: "encrypted",
        name: "Admin",
        role: "SUPER_ADMIN",
      };

      (prisma.user.findUnique as any)
        .mockResolvedValueOnce(adminUser)
        .mockResolvedValueOnce(adminUser);
      (prisma.user.update as any).mockResolvedValue(promotedUser);

      const result = await promoteAdminUserToSuperAdmin("user-admin");

      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-admin" },
        data: expect.objectContaining({ role: "SUPER_ADMIN" }),
      });
    });

    it("rejects when user is already a super admin", async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        id: "user-sa",
        role: "SUPER_ADMIN",
        deletedAt: null,
      });

      const result = await promoteAdminUserToSuperAdmin("user-sa");

      expect(result.success).toBe(false);
      expect(result.error).toContain("already a super admin");
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe("deactivateAdminUser", () => {
    it("should prevent deactivating the last super admin (including self)", async () => {
      const currentUser = {
        id: "admin-123", // Same as admin context userId
        emailCiphertext: "encrypted",
        name: "Admin",
        role: "SUPER_ADMIN",
        deletedAt: null,
      };

      (prisma.user.findUnique as any).mockResolvedValue(currentUser);
      (prisma.user.count as any).mockResolvedValue(1); // Only one super admin on platform

      const result = await deactivateAdminUser("admin-123");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot deactivate the last super admin");
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("should allow super admin deactivation when another super admin exists", async () => {
      const currentUser = {
        id: "admin-123",
        emailCiphertext: "encrypted",
        name: "Admin",
        role: "SUPER_ADMIN",
        deletedAt: null,
      };

      (prisma.user.findUnique as any).mockResolvedValue(currentUser);
      (prisma.user.count as any).mockResolvedValue(2);
      (prisma.user.update as any).mockResolvedValue({});

      const result = await deactivateAdminUser("admin-123");

      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "admin-123" },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
      });
    });
  });

  describe("getAdminUsers", () => {
    it("should return admin users with verification status", async () => {
      const mockAdminUsers = [
        {
          id: "admin-1",
          emailCiphertext: "encrypted1",
          name: "Admin 1",
          role: "SUPER_ADMIN",
          emailVerified: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "admin-2",
          emailCiphertext: "encrypted2",
          name: "Admin 2",
          role: "ADMIN",
          emailVerified: null, // Unverified
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.user.findMany as any).mockResolvedValue(mockAdminUsers);

      const result = await getAdminUsers();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      if (!result.success || !result.data) {
        throw new Error("expected getAdminUsers success with data");
      }

      // Check verification status mapping
      expect(result.data[0].isVerified).toBe(true); // emailVerified is set
      expect(result.data[1].isVerified).toBe(false); // emailVerified is null

      // Check email decryption
      expect(result.data[0].email).toBe("test@example.com");
      expect(result.data[1].email).toBe("test@example.com");
    });

    it("should only return active admin users", async () => {
      (prisma.user.findMany as any).mockResolvedValue([]);

      await getAdminUsers();

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          role: { in: ["ADMIN", "SUPER_ADMIN"] },
          deletedAt: null, // ✅ Only active users
        },
        select: expect.objectContaining({
          id: true,
          emailCiphertext: true,
          name: true,
          role: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
        }),
        orderBy: [
          { role: "desc" }, // Super admins first
          { createdAt: "desc" },
        ],
      });
    });
  });
});