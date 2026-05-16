"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { UserRole } from "@prisma/client";

import { prisma } from "@/lib/db";
import { requireSuperAdminRole } from "@/lib/admin/auth";
import { normalizeUserRoleString } from "@/lib/auth-roles";
import { findUserByEmail } from "@/lib/auth/user-email";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import { logSafeError, safeErrorMessage } from "@/lib/log-safe-error";

async function countOtherLiveSuperAdmins(excludeUserId: string): Promise<number> {
  return prisma.user.count({
    where: {
      role: "SUPER_ADMIN",
      deletedAt: null,
      id: { not: excludeUserId },
    },
  });
}

/** Ensures at least one other active SUPER_ADMIN remains when this user leaves that role or is deactivated. */
async function assertKeepsAnotherLiveSuperAdminIfDemotingThisOne(
  targetId: string,
  targetRole: string
): Promise<void> {
  if (normalizeUserRoleString(targetRole) !== "SUPER_ADMIN") return;
  const others = await countOtherLiveSuperAdmins(targetId);
  if (others < 1) {
    throw new Error(
      "Cannot demote, delete, or remove the last active super admin. Promote another super admin first."
    );
  }
}

const staffUserIdSchema = z.object({ userId: z.string().cuid() });

const staffRoleSchema = z.object({
  userId: z.string().cuid(),
  newRole: z.enum(["ADMIN", "SUPER_ADMIN"]),
});

const promoteEmailSchema = z.object({
  email: z
    .string()
    .email("Invalid email")
    .max(255)
    .transform((s) => s.trim().toLowerCase()),
});

/**
 * Promote an existing client (`USER`) account to `ADMIN` by email.
 * Super-admin only. Target must not be an advisor; use advisor flows for subscribers.
 */
export async function promoteClientUserToAdminStaffBySuperAdmin(input: unknown) {
  try {
    const actor = await requireSuperAdminRole();
    const parsed = promoteEmailSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false as const,
        error: parsed.error.flatten().fieldErrors
          ? Object.values(parsed.error.flatten().fieldErrors).flat().join("; ")
          : "Validation failed",
      };
    }

    const existing = await findUserByEmail(parsed.data.email, {
      select: { id: true, role: true, deletedAt: true, name: true },
    });
    if (!existing) {
      return { success: false as const, error: "No user found for that email." };
    }
    if (existing.deletedAt) {
      return {
        success: false as const,
        error: "That account is deactivated. Restore it before changing roles.",
      };
    }
    const r = normalizeUserRoleString(existing.role);
    if (r === "SUPER_ADMIN" || r === "ADMIN") {
      return { success: false as const, error: "That account is already platform staff." };
    }
    if (r === "ADVISOR") {
      return {
        success: false as const,
        error:
          "Cannot promote a subscriber (advisor) account with this action. Create staff from a client account or adjust roles in the database.",
      };
    }
    if (r !== "USER") {
      return { success: false as const, error: "Only client accounts can be promoted with this action." };
    }

    const beforeRole = existing.role;
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: "ADMIN" },
    });

    await writeAudit({
      actor: {
        userId: actor.userId,
        role: actor.role as UserRole,
        email: actor.email,
      },
      action: AUDIT_ACTIONS.USER_UPDATE,
      entityType: "User",
      entityId: existing.id,
      beforeData: { role: beforeRole, name: existing.name },
      afterData: { role: "ADMIN", name: existing.name },
      metadata: { promotionPath: "client_email_to_admin" },
    });

    revalidatePath("/admin/staff");
    revalidatePath("/admin/clients");
    revalidatePath("/admin");
    return { success: true as const };
  } catch (e) {
    logSafeError("admin/staff/promoteClientToAdmin", e);
    return {
      success: false as const,
      error: safeErrorMessage(e, "Failed to promote user"),
    };
  }
}

/** Set role between `ADMIN` and `SUPER_ADMIN` for an existing staff account. Super-admin only. */
export async function setPlatformStaffRoleBySuperAdmin(input: unknown) {
  try {
    const actor = await requireSuperAdminRole();
    const parsed = staffRoleSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: "Invalid payload" };
    }

    const target = await prisma.user.findFirst({
      where: {
        id: parsed.data.userId,
        role: { in: ["ADMIN", "SUPER_ADMIN"] },
      },
      select: { id: true, role: true, deletedAt: true, name: true },
    });
    if (!target) {
      return { success: false as const, error: "Staff user not found." };
    }
    if (target.deletedAt) {
      return { success: false as const, error: "Restore the account before changing its role." };
    }

    const next = parsed.data.newRole;
    if (target.role === next) {
      return { success: true as const };
    }

    if (normalizeUserRoleString(target.role) === "SUPER_ADMIN" && next === "ADMIN") {
      await assertKeepsAnotherLiveSuperAdminIfDemotingThisOne(target.id, target.role);
    }

    const beforeRole = target.role;
    await prisma.user.update({
      where: { id: target.id },
      data: { role: next },
    });

    await writeAudit({
      actor: {
        userId: actor.userId,
        role: actor.role as UserRole,
        email: actor.email,
      },
      action: AUDIT_ACTIONS.USER_UPDATE,
      entityType: "User",
      entityId: target.id,
      beforeData: { role: beforeRole, name: target.name },
      afterData: { role: next, name: target.name },
      metadata: { path: "platform_staff_role" },
    });

    revalidatePath("/admin/staff");
    revalidatePath("/admin");
    return { success: true as const };
  } catch (e) {
    logSafeError("admin/staff/setRole", e);
    return {
      success: false as const,
      error: safeErrorMessage(e, "Failed to update role"),
    };
  }
}

/** Demote staff (`ADMIN` / `SUPER_ADMIN`) to a client (`USER`). Super-admin only. */
export async function demotePlatformStaffToClientBySuperAdmin(input: unknown) {
  try {
    const actor = await requireSuperAdminRole();
    const parsed = staffUserIdSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: "Invalid payload" };
    }

    if (parsed.data.userId === actor.userId) {
      return { success: false as const, error: "You cannot demote your own account." };
    }

    const target = await prisma.user.findFirst({
      where: {
        id: parsed.data.userId,
        role: { in: ["ADMIN", "SUPER_ADMIN"] },
      },
      select: { id: true, role: true, deletedAt: true, name: true },
    });
    if (!target) {
      return { success: false as const, error: "Staff user not found." };
    }
    if (target.deletedAt) {
      return { success: false as const, error: "Account is already deactivated." };
    }

    await assertKeepsAnotherLiveSuperAdminIfDemotingThisOne(target.id, target.role);

    const beforeRole = target.role;
    await prisma.user.update({
      where: { id: target.id },
      data: { role: "USER" },
    });

    await writeAudit({
      actor: {
        userId: actor.userId,
        role: actor.role as UserRole,
        email: actor.email,
      },
      action: AUDIT_ACTIONS.USER_UPDATE,
      entityType: "User",
      entityId: target.id,
      beforeData: { role: beforeRole, name: target.name },
      afterData: { role: "USER", name: target.name },
      metadata: { path: "platform_staff_demote_to_client" },
    });

    revalidatePath("/admin/staff");
    revalidatePath("/admin/clients");
    revalidatePath("/admin");
    return { success: true as const };
  } catch (e) {
    logSafeError("admin/staff/demote", e);
    return {
      success: false as const,
      error: safeErrorMessage(e, "Failed to demote user"),
    };
  }
}

export async function softDeletePlatformStaffBySuperAdmin(input: unknown) {
  try {
    const actor = await requireSuperAdminRole();
    const parsed = staffUserIdSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: "Invalid payload" };
    }

    if (parsed.data.userId === actor.userId) {
      return { success: false as const, error: "You cannot deactivate your own account." };
    }

    const target = await prisma.user.findFirst({
      where: {
        id: parsed.data.userId,
        role: { in: ["ADMIN", "SUPER_ADMIN"] },
      },
      select: { id: true, role: true, deletedAt: true },
    });
    if (!target) {
      return { success: false as const, error: "Staff user not found." };
    }
    if (target.deletedAt) {
      return { success: false as const, error: "Account is already deactivated." };
    }

    await assertKeepsAnotherLiveSuperAdminIfDemotingThisOne(target.id, target.role);

    const deletedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: target.id },
        data: {
          deletedAt,
          advisorPortalAccessEnabled: false,
        },
      });
      await tx.session.deleteMany({ where: { userId: target.id } });
    });

    await writeAudit({
      actor: {
        userId: actor.userId,
        role: actor.role as UserRole,
        email: actor.email,
      },
      action: AUDIT_ACTIONS.USER_SOFT_DELETE,
      entityType: "User",
      entityId: target.id,
      beforeData: { deletedAt: null, advisorPortalAccessEnabled: true },
      afterData: { deletedAt: deletedAt.toISOString(), advisorPortalAccessEnabled: false },
      metadata: { path: "platform_staff_soft_delete" },
    });

    revalidatePath("/admin/staff");
    revalidatePath("/admin");
    return { success: true as const };
  } catch (e) {
    logSafeError("admin/staff/softDelete", e);
    return {
      success: false as const,
      error: safeErrorMessage(e, "Failed to deactivate account"),
    };
  }
}

export async function restorePlatformStaffBySuperAdmin(input: unknown) {
  try {
    const actor = await requireSuperAdminRole();
    const parsed = staffUserIdSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: "Invalid payload" };
    }

    const target = await prisma.user.findFirst({
      where: {
        id: parsed.data.userId,
        role: { in: ["ADMIN", "SUPER_ADMIN"] },
      },
      select: { id: true, deletedAt: true, advisorPortalAccessEnabled: true },
    });
    if (!target) {
      return { success: false as const, error: "Staff user not found." };
    }
    if (!target.deletedAt) {
      return { success: false as const, error: "Account is not deactivated." };
    }

    const prevDeleted = target.deletedAt;
    await prisma.user.update({
      where: { id: target.id },
      data: {
        deletedAt: null,
        advisorPortalAccessEnabled: true,
      },
    });

    await writeAudit({
      actor: {
        userId: actor.userId,
        role: actor.role as UserRole,
        email: actor.email,
      },
      action: AUDIT_ACTIONS.USER_RESTORE,
      entityType: "User",
      entityId: target.id,
      beforeData: {
        deletedAt: prevDeleted.toISOString(),
        advisorPortalAccessEnabled: target.advisorPortalAccessEnabled,
      },
      afterData: { deletedAt: null, advisorPortalAccessEnabled: true },
      metadata: { path: "platform_staff_restore" },
    });

    revalidatePath("/admin/staff");
    revalidatePath("/admin");
    return { success: true as const };
  } catch (e) {
    logSafeError("admin/staff/restore", e);
    return {
      success: false as const,
      error: safeErrorMessage(e, "Failed to restore account"),
    };
  }
}
