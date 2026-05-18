"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSuperAdminRole } from "@/lib/admin/auth";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import bcrypt from "bcryptjs";
import { sendAdminInvitationEmail } from "@/lib/email/admin-invitation";
import { withDecryptedEmail, findUserByEmail, userEmailWriteData, userEmailForDisplay } from "@/lib/auth/user-email";

// Validation schema for admin user creation
const CreateAdminUserSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  role: z.enum(["ADMIN", "SUPER_ADMIN"], {
    message: "Role must be ADMIN or SUPER_ADMIN"
  }),
  sendInvitation: z.boolean().default(true),
});

// Validation schema for admin user updates
const UpdateAdminUserSchema = z.object({
  id: z.string().min(1, "User ID is required"),
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters").optional(),
  role: z.enum(["ADMIN", "SUPER_ADMIN"]).optional(),
  isActive: z.boolean().optional(),
});

export type CreateAdminUserInput = z.infer<typeof CreateAdminUserSchema>;
export type UpdateAdminUserInput = z.infer<typeof UpdateAdminUserSchema>;

/**
 * Create a new admin user (super admin only).
 */
export async function createAdminUser(input: CreateAdminUserInput) {
  const adminContext = await requireSuperAdminRole();

  // Validate input
  const validation = CreateAdminUserSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Invalid input data",
    };
  }

  const { email, name, role, sendInvitation } = validation.data;

  try {
    // Check if user already exists
    const existingUser = await findUserByEmail(email.toLowerCase(), {
      select: { id: true, deletedAt: true, role: true },
    });

    if (existingUser && !existingUser.deletedAt) {
      return {
        success: false,
        error: `A user with email ${email} already exists`,
      };
    }

    // Generate a secure temporary password
    const tempPassword = generateSecurePassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    // Create or reactivate the user
    const user = existingUser?.deletedAt
      ? await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            name,
            role: role as UserRole,
            password: hashedPassword,
            deletedAt: null,
            emailVerified: null, // Require email verification
            updatedAt: new Date(),
          },
        })
      : await prisma.user.create({
          data: {
            ...userEmailWriteData(email.toLowerCase()),
            name,
            role: role as UserRole,
            password: hashedPassword,
            emailVerified: null, // Require email verification
          },
        });

    // Send invitation email if requested
    if (sendInvitation) {
      await sendAdminInvitationEmail({
        email: email.toLowerCase(),
        name: user.name!,
        tempPassword,
        role,
        invitedBy: adminContext.email || "Super Admin",
      });
    }

    // Audit log the action
    await writeAudit({
      actor: {
        userId: adminContext.userId,
        email: adminContext.email,
        role: "SUPER_ADMIN",
      },
      action: AUDIT_ACTIONS.ADMIN_USER_CREATED,
      entityType: "User",
      entityId: user.id,
      beforeData: null,
      afterData: {
        email: email.toLowerCase(),
        name: user.name,
        role: user.role,
        invitationSent: sendInvitation,
      },
      metadata: {
        adminEmail: email.toLowerCase(),
        adminRole: role,
        createdByEmail: adminContext.email,
      },
    });

    revalidatePath("/admin/staff");

    return {
      success: true,
      data: {
        id: user.id,
        email: email.toLowerCase(),
        name: user.name,
        role: user.role,
        tempPassword: sendInvitation ? undefined : tempPassword, // Only return password if not emailed
      },
    };
  } catch (error) {
    console.error("Failed to create admin user:", error);
    return {
      success: false,
      error: "Failed to create admin user. Please try again.",
    };
  }
}

/**
 * Update an existing admin user (super admin only).
 */
export async function updateAdminUser(input: UpdateAdminUserInput) {
  const adminContext = await requireSuperAdminRole();

  // Validate input
  const validation = UpdateAdminUserSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Invalid input data",
    };
  }

  const { id, ...updates } = validation.data;

  try {
    // Get current user data
    const currentUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        emailCiphertext: true,
        name: true,
        role: true,
        deletedAt: true
      },
    });

    if (!currentUser || currentUser.deletedAt) {
      return {
        success: false,
        error: "Admin user not found",
      };
    }

    // Prevent super admin from demoting themselves
    if (currentUser.id === adminContext.userId && updates.role === "ADMIN") {
      return {
        success: false,
        error: "You cannot demote your own super admin role",
      };
    }

    // Update the user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...updates,
        role: updates.role as UserRole, // Cast to match Prisma enum
        updatedAt: new Date(),
      },
    });

    // Audit log the action
    await writeAudit({
      actor: {
        userId: adminContext.userId,
        email: adminContext.email,
        role: "SUPER_ADMIN",
      },
      action: AUDIT_ACTIONS.ADMIN_USER_UPDATED,
      entityType: "User",
      entityId: id,
      beforeData: {
        name: currentUser.name,
        role: currentUser.role,
      },
      afterData: {
        name: updatedUser.name,
        role: updatedUser.role,
      },
      metadata: {
        adminEmail: userEmailForDisplay(currentUser),
        updatedByEmail: adminContext.email,
        changes: updates,
      },
    });

    revalidatePath("/admin/staff");

    return {
      success: true,
      data: {
        id: updatedUser.id,
        email: userEmailForDisplay(updatedUser),
        name: updatedUser.name,
        role: updatedUser.role,
      },
    };
  } catch (error) {
    console.error("Failed to update admin user:", error);
    return {
      success: false,
      error: "Failed to update admin user. Please try again.",
    };
  }
}

/**
 * Deactivate an admin user (super admin only).
 */
export async function deactivateAdminUser(userId: string) {
  const adminContext = await requireSuperAdminRole();

  try {
    // Get current user data
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        emailCiphertext: true,
        name: true,
        role: true,
        deletedAt: true
      },
    });

    if (!currentUser || currentUser.deletedAt) {
      return {
        success: false,
        error: "Admin user not found",
      };
    }

    // Prevent super admin from deactivating themselves
    if (currentUser.id === adminContext.userId) {
      return {
        success: false,
        error: "You cannot deactivate your own account",
      };
    }

    // Soft delete the user
    await prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Audit log the action
    await writeAudit({
      actor: {
        userId: adminContext.userId,
        email: adminContext.email,
        role: "SUPER_ADMIN",
      },
      action: AUDIT_ACTIONS.ADMIN_USER_DEACTIVATED,
      entityType: "User",
      entityId: userId,
      beforeData: {
        name: currentUser.name,
        role: currentUser.role,
        deletedAt: null,
      },
      afterData: {
        name: currentUser.name,
        role: currentUser.role,
        deletedAt: new Date().toISOString(),
      },
      metadata: {
        adminEmail: userEmailForDisplay(currentUser),
        deactivatedByEmail: adminContext.email,
      },
    });

    revalidatePath("/admin/staff");

    return {
      success: true,
      data: { id: userId },
    };
  } catch (error) {
    console.error("Failed to deactivate admin user:", error);
    return {
      success: false,
      error: "Failed to deactivate admin user. Please try again.",
    };
  }
}

/**
 * Generate a secure temporary password.
 */
function generateSecurePassword(): string {
  const length = 16;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

/**
 * Get all admin users (super admin only).
 */
export async function getAdminUsers() {
  const _adminContext = await requireSuperAdminRole();

  try {
    const adminUsers = await prisma.user.findMany({
      where: {
        role: {
          in: ["ADMIN", "SUPER_ADMIN"],
        },
        deletedAt: null,
      },
      select: {
        id: true,
        emailCiphertext: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { role: "desc" }, // Super admins first
        { createdAt: "desc" },
      ],
    });

    return {
      success: true,
      data: adminUsers.map((user) => ({
        ...withDecryptedEmail(user),
        role: user.role as "ADMIN" | "SUPER_ADMIN",
        isVerified: !!user.emailVerified,
      })),
    };
  } catch (error) {
    console.error("Failed to get admin users:", error);
    return {
      success: false,
      error: "Failed to load admin users. Please try again.",
    };
  }
}