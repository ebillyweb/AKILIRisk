"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { subscriptionQualifiesForPortalEnablement } from "@/lib/billing/advisor-portal-subscription";
import { TIER_LIMITS } from "@/lib/billing/constants";
import { isBillingEnabled } from "@/lib/billing/config";
import {
  buildNewAdvisorWelcomeEmailHtml,
  formatUtcCalendarDate,
  newAdvisorGracePeriodEndsAt,
  newAdvisorPaidSignupDeadline,
} from "@/lib/billing/new-advisor-grace";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendNotification } from "@/lib/notifications/service";
import { resolvePublicAppUrl } from "@/lib/public-app-url";
import { requireAdminRole } from "@/lib/admin/auth";
import { getAdvisorForAdmin } from "@/lib/admin/queries";
import { logSafeError, safeErrorMessage } from "@/lib/log-safe-error";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import { findUserByEmail, userEmailWriteData } from "@/lib/auth/user-email";
import {
  ENTERPRISE_DEFAULT_CLIENT_LIMIT,
  ENTERPRISE_DEFAULT_PER_ADVISOR_CLIENT_LIMIT,
  ENTERPRISE_DEFAULT_SEAT_LIMIT,
} from "@/lib/enterprise/constants";
import { cancelSoloSubscriptionForEnterprise } from "@/lib/enterprise/cancel-solo-subscription";
import { scheduleEnterpriseProvision, queueEnterpriseProvision } from "@/lib/enterprise/schedule-enterprise-provision";
import {
  deleteEnterpriseFirmByAdmin,
  EnterpriseLifecycleError,
  reactivateEnterpriseFirmByAdmin,
  suspendEnterpriseFirmByAdmin,
} from "@/lib/enterprise/firm-lifecycle";
import { isSubdomainReserved, validateSubdomainFormat } from "@/lib/advisor/subdomain";
import {
  passwordComplexitySchema,
  validatePasswordForSet,
} from "@/lib/auth/password-policy";
import { getPasswordPolicy } from "@/lib/platform/password-policy-settings";
import { hashPasswordForStorage } from "@/lib/auth/password-update";

// Round-11 bug-hunt fix: normalize email casing — both schemas
// trim+lowercase so userEmailWriteData (deterministic ciphertext,
// case-sensitive) produces a value that matches whatever case the
// advisor or admin types in later auth flows. See commit A.
const updateAdvisorSchema = z.object({
  userId: z.string().cuid(),
  name: z.string().min(1, "Name is required").max(200).optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  email: z
    .string()
    .email("Invalid email")
    .max(255)
    .transform((s) => s.trim().toLowerCase()),
  firmName: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  jobTitle: z.string().max(200).optional(),
  licenseNumber: z.string().max(100).optional(),
  bio: z.string().max(2000).optional(),
  specializations: z.array(z.string().max(100)).optional(),
});

export type UpdateAdvisorInput = z.infer<typeof updateAdvisorSchema>;

export async function updateAdvisorByAdmin(input: UpdateAdvisorInput) {
  try {
    const { userId: actorUserId, email: actorEmail, role: actorRole } = await requireAdminRole();
    const parsed = updateAdvisorSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.flatten().fieldErrors
          ? Object.values(parsed.error.flatten().fieldErrors).flat().join("; ")
          : "Validation failed",
      };
    }

    const existing = await getAdvisorForAdmin(parsed.data.userId);
    if (!existing) {
      return { success: false, error: "Advisor not found" };
    }
    if (existing.deletedAt) {
      return {
        success: false,
        error: "This advisor is deactivated. Restore the account before editing.",
      };
    }

    const normalizedNewEmail = parsed.data.email;
    const normalizedExistingEmail = existing.email.trim().toLowerCase();
    if (normalizedNewEmail !== normalizedExistingEmail) {
      const conflict = await findUserByEmail(normalizedNewEmail, {
        select: { id: true },
      });
      if (conflict && conflict.id !== parsed.data.userId) {
        return {
          success: false,
          error: "An account with this email already exists",
        };
      }
    }

    // Round-11 commit 2.3 (BRD §5.1.AUTH / phase A): dual-write —
    // userEmailWriteData populates both `email` and `emailCiphertext`.
    await prisma.user.update({
      where: { id: parsed.data.userId },
      data: {
        name: parsed.data.name ?? undefined,
        firstName: parsed.data.firstName ?? undefined,
        lastName: parsed.data.lastName ?? undefined,
        ...userEmailWriteData(parsed.data.email),
      },
    });

    if (existing.advisorProfile) {
      await prisma.advisorProfile.update({
        where: { id: existing.advisorProfile.id },
        data: {
          firmName: parsed.data.firmName ?? undefined,
          phone: parsed.data.phone ?? undefined,
          jobTitle: parsed.data.jobTitle ?? undefined,
          licenseNumber: parsed.data.licenseNumber ?? undefined,
          bio: parsed.data.bio ?? undefined,
          specializations: parsed.data.specializations ?? undefined,
          ...(parsed.data.firmName !== undefined
            ? { brandName: parsed.data.firmName?.trim() || null }
            : {}),
        },
      });
    } else {
      await prisma.advisorProfile.create({
        data: {
          userId: parsed.data.userId,
          firmName: parsed.data.firmName ?? undefined,
          phone: parsed.data.phone ?? undefined,
          jobTitle: parsed.data.jobTitle ?? undefined,
          licenseNumber: parsed.data.licenseNumber ?? undefined,
          bio: parsed.data.bio ?? undefined,
          specializations: parsed.data.specializations ?? [],
        },
      });
    }

    await writeAudit({
      actor: { userId: actorUserId, role: actorRole as UserRole, email: actorEmail },
      action: AUDIT_ACTIONS.USER_UPDATE,
      entityType: "User",
      entityId: parsed.data.userId,
      beforeData: {
        email: existing.email,
        name: existing.name,
        firstName: existing.firstName,
        lastName: existing.lastName,
        firmName: existing.advisorProfile?.firmName ?? null,
        phone: existing.advisorProfile?.phone ?? null,
        jobTitle: existing.advisorProfile?.jobTitle ?? null,
        licenseNumber: existing.advisorProfile?.licenseNumber ?? null,
        bio: existing.advisorProfile?.bio ?? null,
        specializations: existing.advisorProfile?.specializations ?? [],
      },
      afterData: {
        email: parsed.data.email,
        name: parsed.data.name ?? null,
        firstName: parsed.data.firstName ?? null,
        lastName: parsed.data.lastName ?? null,
        firmName: parsed.data.firmName ?? null,
        phone: parsed.data.phone ?? null,
        jobTitle: parsed.data.jobTitle ?? null,
        licenseNumber: parsed.data.licenseNumber ?? null,
        bio: parsed.data.bio ?? null,
        specializations: parsed.data.specializations ?? [],
      },
    });

    revalidatePath("/admin/advisors");
    revalidatePath("/admin");
    return { success: true };
  } catch (e) {
    logSafeError("admin/updateAdvisor", e);
    return { success: false, error: safeErrorMessage(e, "Failed to update advisor") };
  }
}

const createAdvisorSchema = z.object({
  email: z
    .string()
    .email("Invalid email")
    .max(255)
    .transform((s) => s.trim().toLowerCase()),
  password: passwordComplexitySchema.max(100),
  name: z.string().min(1, "Name is required").max(200).optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  firmName: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  jobTitle: z.string().max(200).optional(),
  licenseNumber: z.string().max(100).optional(),
  bio: z.string().max(2000).optional(),
  specializations: z.array(z.string().max(100)).optional(),
});

export type CreateAdvisorInput = z.infer<typeof createAdvisorSchema>;

const setAdvisorPortalAccessSchema = z.object({
  userId: z.string().cuid(),
  enabled: z.boolean(),
});

export async function setAdvisorPortalAccessByAdmin(input: unknown) {
  try {
    const { userId: actorUserId, email: actorEmail, role: actorRole } = await requireAdminRole();
    const parsed = setAdvisorPortalAccessSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.flatten().fieldErrors
          ? Object.values(parsed.error.flatten().fieldErrors).flat().join("; ")
          : "Validation failed",
      };
    }

    const target = await prisma.user.findFirst({
      where: { id: parsed.data.userId, role: "ADVISOR" },
      // advisorPortalAccessEnabled selected so the audit row's beforeData
      // captures the actual prior value (not just the inverse of the new one,
      // which is wrong when admin re-applies the same setting).
      select: { id: true, deletedAt: true, advisorPortalAccessEnabled: true },
    });
    if (!target) {
      return { success: false, error: "Advisor not found" };
    }
    if (target.deletedAt) {
      return {
        success: false,
        error: "Cannot change portal access for a deactivated advisor. Restore the account first.",
      };
    }

    if (parsed.data.enabled) {
      const { resolveBillingContext, subscriptionForPortalFromContext } =
        await import("@/lib/enterprise/billing-context");
      const billingCtx = await resolveBillingContext(target.id);
      const subSnapshot = billingCtx
        ? subscriptionForPortalFromContext(billingCtx)
        : null;
      const sub =
        subSnapshot ??
        (await prisma.subscription.findUnique({
          where: { userId: target.id },
          select: {
            status: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
            stripeSubscriptionId: true,
            createdAt: true,
          },
        }));
      const billingOn = isBillingEnabled();
      if (!subscriptionQualifiesForPortalEnablement(sub, billingOn)) {
        return {
          success: false,
          error: billingOn
            ? "Complete an active Stripe subscription for this advisor before enabling portal access. Calendar grace qualifies only until the next UTC day; paid signup is required within 30 days of account creation."
            : "Subscription must be qualifying (active, past due, or grace period before current period end). Update the subscription row before enabling portal access.",
        };
      }
    }

    await prisma.user.update({
      where: { id: target.id },
      data: { advisorPortalAccessEnabled: parsed.data.enabled },
    });

    await writeAudit({
      actor: { userId: actorUserId, role: actorRole as UserRole, email: actorEmail },
      action: AUDIT_ACTIONS.USER_PORTAL_ACCESS_TOGGLE,
      entityType: "User",
      entityId: target.id,
      beforeData: { advisorPortalAccessEnabled: target.advisorPortalAccessEnabled },
      afterData: { advisorPortalAccessEnabled: parsed.data.enabled },
    });

    revalidatePath("/admin/advisors");
    revalidatePath(`/admin/advisors/${parsed.data.userId}/edit`);
    revalidatePath("/admin");
    return { success: true };
  } catch (e) {
    logSafeError("admin/togglePortalAccess", e);
    return { success: false, error: safeErrorMessage(e, "Failed to update portal access") };
  }
}

export async function createAdvisorByAdmin(input: CreateAdvisorInput) {
  try {
    const { userId: actorUserId, email: actorEmail, role: actorRole } = await requireAdminRole();
    const parsed = createAdvisorSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.flatten().fieldErrors
          ? Object.values(parsed.error.flatten().fieldErrors).flat().join("; ")
          : "Validation failed",
      };
    }

    // Intentional: this lookup does NOT filter `deletedAt: null`. A
    // soft-deleted account permanently blocks creating a new advisor under
    // the same email. We retain that audit trail and prevent identity reuse;
    // an admin must restore (`restoreAdvisorByAdmin`) or hard-delete the
    // existing row to free the email. Mirrors the same intent on the
    // public registration path in src/app/api/auth/register/route.ts.
    // Round-11 commit 2.3 (BRD §5.1.AUTH / phase A): dual-read shim
    // so soft-deleted rows backfilled with ciphertext-only still
    // block re-registration.
    const existing = await findUserByEmail(parsed.data.email, {
      select: { id: true },
    });
    if (existing) {
      return { success: false, error: "An account with this email already exists" };
    }

    const policy = await getPasswordPolicy();
    const passwordPolicy = await validatePasswordForSet(
      parsed.data.password,
      policy
    );
    if (!passwordPolicy.ok) {
      return { success: false, error: passwordPolicy.error };
    }

    const hashedPassword = await hashPasswordForStorage(parsed.data.password);
    const createdAt = new Date();
    const gracePeriodEnd = newAdvisorGracePeriodEndsAt(createdAt);
    const paidSignupDeadline = newAdvisorPaidSignupDeadline(createdAt);

    const firm = parsed.data.firmName?.trim() || null;
    const displayName =
      parsed.data.name?.trim() ||
      [parsed.data.firstName, parsed.data.lastName].filter(Boolean).join(" ").trim() ||
      parsed.data.email;

    const { user, profile } = await prisma.$transaction(async (tx) => {
      // Round-11 commit 2.3 (BRD §5.1.AUTH / phase A): dual-write.
      const u = await tx.user.create({
        data: {
          ...userEmailWriteData(parsed.data.email),
          password: hashedPassword,
          passwordChangeRequired: false,
          passwordPolicyRevision: policy.revision,
          role: "ADVISOR",
          name: parsed.data.name ?? undefined,
          firstName: parsed.data.firstName ?? undefined,
          lastName: parsed.data.lastName ?? undefined,
        },
        // Round-11 commit 2.4b: only id needed downstream — the
        // welcome notification uses parsed.data.email (form input
        // plaintext) directly.
        select: { id: true },
      });

      const p = await tx.advisorProfile.create({
        data: {
          userId: u.id,
          firmName: firm ?? undefined,
          brandName: firm,
          phone: parsed.data.phone ?? undefined,
          jobTitle: parsed.data.jobTitle ?? undefined,
          licenseNumber: parsed.data.licenseNumber ?? undefined,
          bio: parsed.data.bio ?? undefined,
          specializations: parsed.data.specializations ?? [],
        },
      });

      const sub = await tx.subscription.create({
        data: {
          userId: u.id,
          tier: "PROFESSIONAL",
          status: "GRACE_PERIOD",
          clientLimit: TIER_LIMITS.PROFESSIONAL,
          billingCycle: "MONTHLY",
          currentPeriodEnd: gracePeriodEnd,
        },
      });

      await tx.subscriptionAuditLog.create({
        data: {
          subscriptionId: sub.id,
          action: "admin_new_advisor_grace",
          newTier: "PROFESSIONAL",
          metadata: {
            gracePeriodEnd: gracePeriodEnd.toISOString(),
            paidSignupDeadline: paidSignupDeadline.toISOString(),
          },
        },
      });

      return { user: u, profile: p };
    });

    try {
      const base = (await resolvePublicAppUrl()).replace(/\/$/, "");
      const signInUrl = `${base}/signin`;
      const billingUrl = `${base}/advisor/billing`;
      const billingOn = isBillingEnabled();
      const emailHtml = buildNewAdvisorWelcomeEmailHtml({
        displayName,
        graceEndsAt: gracePeriodEnd,
        paidSignupDeadline,
        signInUrl,
        billingUrl,
        billingEnabled: billingOn,
      });
      await sendNotification({
        recipientUserId: user.id,
        // Round-11 commit 2.4b: use form-input plaintext (in scope).
        recipientEmail: parsed.data.email,
        category: "system",
        title: "Welcome — complete signup within 30 days",
        message: `Grace for hub access ends ${formatUtcCalendarDate(gracePeriodEnd)} (UTC, start of next calendar day). Complete paid subscription within 30 days by ${formatUtcCalendarDate(paidSignupDeadline)}.`,
        referenceId: `new-advisor-${user.id}`,
        advisorProfileId: profile.id,
        emailSubject: "Akili Risk — Your advisor account is ready",
        emailHtml,
      });
    } catch (notifyErr) {
      console.error("New advisor welcome notification failed:", notifyErr);
    }

    await writeAudit({
      actor: { userId: actorUserId, role: actorRole as UserRole, email: actorEmail },
      action: AUDIT_ACTIONS.USER_CREATE,
      entityType: "User",
      entityId: user.id,
      beforeData: null,
      // password/hash never reaches the audit row — redactor strips any key
      // matching /password/i. Email is hashed by the redactor's email rule.
      afterData: {
        id: user.id,
        email: parsed.data.email,
        role: "ADVISOR",
        name: parsed.data.name ?? null,
        firstName: parsed.data.firstName ?? null,
        lastName: parsed.data.lastName ?? null,
        firmName: firm,
        advisorProfileId: profile.id,
      },
      metadata: {
        gracePeriodEndIso: gracePeriodEnd.toISOString(),
        paidSignupDeadlineIso: paidSignupDeadline.toISOString(),
      },
    });

    revalidatePath("/admin/advisors");
    revalidatePath("/admin");
    return { success: true, data: { userId: user.id } };
  } catch (e) {
    // P2002 on the User.email unique constraint is the most likely Prisma
    // error here — its message contains the colliding email. logSafeError
    // strips that for the log; safeErrorMessage substitutes a generic
    // string for the admin UI.
    logSafeError("admin/createAdvisor", e);
    return { success: false, error: safeErrorMessage(e, "Failed to create advisor") };
  }
}

const adminAdvisorUserIdSchema = z.object({
  userId: z.string().cuid(),
});

export async function softDeleteAdvisorByAdmin(input: unknown) {
  try {
    const { userId: adminUserId, email: adminEmail, role: adminRole } = await requireAdminRole();
    const parsed = adminAdvisorUserIdSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.flatten().fieldErrors
          ? Object.values(parsed.error.flatten().fieldErrors).flat().join("; ")
          : "Validation failed",
      };
    }

    if (parsed.data.userId === adminUserId) {
      return { success: false, error: "You cannot deactivate your own account." };
    }

    const target = await prisma.user.findFirst({
      where: { id: parsed.data.userId, role: "ADVISOR" },
      select: {
        id: true,
        deletedAt: true,
        advisorProfile: { select: { id: true } },
      },
    });
    if (!target) {
      return { success: false, error: "Advisor not found" };
    }
    if (target.deletedAt) {
      return { success: false, error: "Advisor is already deactivated" };
    }

    const deletedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: target.id },
        data: {
          deletedAt,
          advisorPortalAccessEnabled: false,
        },
      });
      if (target.advisorProfile?.id) {
        await tx.clientAdvisorAssignment.updateMany({
          where: { advisorId: target.advisorProfile.id, status: "ACTIVE" },
          data: { status: "INACTIVE" },
        });
      }
      await tx.session.deleteMany({ where: { userId: target.id } });
    });

    await writeAudit({
      actor: { userId: adminUserId, role: adminRole as UserRole, email: adminEmail },
      action: AUDIT_ACTIONS.USER_SOFT_DELETE,
      entityType: "User",
      entityId: target.id,
      beforeData: { deletedAt: null, advisorPortalAccessEnabled: true },
      afterData: { deletedAt: deletedAt.toISOString(), advisorPortalAccessEnabled: false },
      metadata: {
        cascade: {
          advisorProfileId: target.advisorProfile?.id ?? null,
          assignmentsDeactivated: target.advisorProfile?.id != null,
          sessionsDeleted: true,
        },
      },
    });

    revalidatePath("/admin/advisors");
    revalidatePath(`/admin/advisors/${parsed.data.userId}/edit`);
    revalidatePath("/admin/clients");
    revalidatePath("/admin/leads");
    revalidatePath("/admin");
    return { success: true };
  } catch (e) {
    logSafeError("admin/softDeleteAdvisor", e);
    return { success: false, error: safeErrorMessage(e, "Failed to deactivate advisor") };
  }
}

export async function restoreAdvisorByAdmin(input: unknown) {
  try {
    const { userId: actorUserId, email: actorEmail, role: actorRole } = await requireAdminRole();
    const parsed = adminAdvisorUserIdSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.flatten().fieldErrors
          ? Object.values(parsed.error.flatten().fieldErrors).flat().join("; ")
          : "Validation failed",
      };
    }

    const target = await prisma.user.findFirst({
      where: { id: parsed.data.userId, role: "ADVISOR" },
      select: {
        id: true,
        deletedAt: true,
        advisorProfile: { select: { id: true } },
      },
    });
    if (!target) {
      return { success: false, error: "Advisor not found" };
    }
    if (!target.deletedAt) {
      return { success: false, error: "Advisor is not deactivated" };
    }

    const previousDeletedAt = target.deletedAt;
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: target.id },
        data: {
          deletedAt: null,
          advisorPortalAccessEnabled: true,
        },
      });
      if (target.advisorProfile?.id) {
        await tx.clientAdvisorAssignment.updateMany({
          where: { advisorId: target.advisorProfile.id, status: "INACTIVE" },
          data: { status: "ACTIVE" },
        });
      }
    });

    await writeAudit({
      actor: { userId: actorUserId, role: actorRole as UserRole, email: actorEmail },
      action: AUDIT_ACTIONS.USER_RESTORE,
      entityType: "User",
      entityId: target.id,
      beforeData: {
        deletedAt: previousDeletedAt?.toISOString() ?? null,
        advisorPortalAccessEnabled: false,
      },
      afterData: { deletedAt: null, advisorPortalAccessEnabled: true },
      metadata: {
        cascade: {
          advisorProfileId: target.advisorProfile?.id ?? null,
          assignmentsReactivated: target.advisorProfile?.id != null,
        },
      },
    });

    revalidatePath("/admin/advisors");
    revalidatePath(`/admin/advisors/${parsed.data.userId}/edit`);
    revalidatePath("/admin/clients");
    revalidatePath("/admin/leads");
    revalidatePath("/admin");
    return { success: true };
  } catch (e) {
    logSafeError("admin/restoreAdvisor", e);
    return { success: false, error: safeErrorMessage(e, "Failed to restore advisor") };
  }
}

const adminClientUserIdSchema = z.object({
  userId: z.string().cuid(),
});

export async function softDeleteClientByAdmin(input: unknown) {
  try {
    const { userId: adminUserId, email: adminEmail, role: adminRole } = await requireAdminRole();
    const parsed = adminClientUserIdSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.flatten().fieldErrors
          ? Object.values(parsed.error.flatten().fieldErrors).flat().join("; ")
          : "Validation failed",
      };
    }

    if (parsed.data.userId === adminUserId) {
      return { success: false, error: "You cannot deactivate your own account." };
    }

    const target = await prisma.user.findFirst({
      where: { id: parsed.data.userId, role: "USER" },
      select: { id: true, deletedAt: true },
    });
    if (!target) {
      return { success: false, error: "Client not found" };
    }
    if (target.deletedAt) {
      return { success: false, error: "Client is already deactivated" };
    }

    const deletedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: target.id },
        data: { deletedAt },
      });
      await tx.clientAdvisorAssignment.updateMany({
        where: { clientId: target.id, status: "ACTIVE" },
        data: { status: "INACTIVE" },
      });
      await tx.session.deleteMany({ where: { userId: target.id } });
    });

    await writeAudit({
      actor: { userId: adminUserId, role: adminRole as UserRole, email: adminEmail },
      action: AUDIT_ACTIONS.USER_SOFT_DELETE,
      entityType: "User",
      entityId: target.id,
      beforeData: { deletedAt: null },
      afterData: { deletedAt: deletedAt.toISOString() },
      metadata: {
        cascade: {
          assignmentsDeactivated: true,
          sessionsDeleted: true,
        },
      },
    });

    revalidatePath("/admin/clients");
    revalidatePath("/admin");
    return { success: true };
  } catch (e) {
    logSafeError("admin/softDeleteClient", e);
    return { success: false, error: safeErrorMessage(e, "Failed to deactivate client") };
  }
}

export async function restoreClientByAdmin(input: unknown) {
  try {
    const { userId: actorUserId, email: actorEmail, role: actorRole } = await requireAdminRole();
    const parsed = adminClientUserIdSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.flatten().fieldErrors
          ? Object.values(parsed.error.flatten().fieldErrors).flat().join("; ")
          : "Validation failed",
      };
    }

    const target = await prisma.user.findFirst({
      where: { id: parsed.data.userId, role: "USER" },
      select: { id: true, deletedAt: true },
    });
    if (!target) {
      return { success: false, error: "Client not found" };
    }
    if (!target.deletedAt) {
      return { success: false, error: "Client is not deactivated" };
    }

    const previousDeletedAt = target.deletedAt;
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: target.id },
        data: { deletedAt: null },
      });
      await tx.clientAdvisorAssignment.updateMany({
        where: { clientId: target.id, status: "INACTIVE" },
        data: { status: "ACTIVE" },
      });
    });

    await writeAudit({
      actor: { userId: actorUserId, role: actorRole as UserRole, email: actorEmail },
      action: AUDIT_ACTIONS.USER_RESTORE,
      entityType: "User",
      entityId: target.id,
      beforeData: {
        deletedAt: previousDeletedAt?.toISOString() ?? null,
      },
      afterData: { deletedAt: null },
      metadata: {
        cascade: {
          assignmentsReactivated: true,
        },
      },
    });

    revalidatePath("/admin/clients");
    revalidatePath("/admin");
    return { success: true };
  } catch (e) {
    logSafeError("admin/restoreClient", e);
    return { success: false, error: safeErrorMessage(e, "Failed to restore client") };
  }
}

const moduleTierSchema = z.enum(["ESSENTIALS", "PROFESSIONAL", "BUSINESS", "PLATINUM"]);

const createEnterpriseSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  slug: z
    .string()
    .min(3)
    .max(20)
    .transform((s) => s.trim().toLowerCase()),
  ownerUserId: z.string().cuid(),
  moduleTier: moduleTierSchema,
  seatLimit: z.number().int().positive().optional(),
  clientLimit: z.number().int().positive().optional(),
  perAdvisorClientLimit: z.number().int().positive().optional(),
  paymentMethod: z.enum(["WIRE", "CARD"]),
  stripeSubscriptionId: z.string().min(1).optional(),
  stripeCustomerId: z.string().min(1).optional(),
  billingCycle: z.enum(["MONTHLY", "ANNUAL"]).optional(),
});

export type CreateEnterpriseInput = z.infer<typeof createEnterpriseSchema>;

export async function createEnterpriseByAdmin(input: unknown) {
  try {
    const { userId: actorUserId, email: actorEmail, role: actorRole } =
      await requireAdminRole();
    const parsed = createEnterpriseSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.flatten().fieldErrors
          ? Object.values(parsed.error.flatten().fieldErrors).flat().join("; ")
          : "Validation failed",
      };
    }

    const slugCheck = validateSubdomainFormat(parsed.data.slug);
    if (!slugCheck.valid) {
      return { success: false, error: slugCheck.error ?? "Invalid slug" };
    }

    const reserved = await isSubdomainReserved(parsed.data.slug);
    if (reserved.reserved) {
      return {
        success: false,
        error: reserved.reason ?? "This subdomain is reserved",
      };
    }

    const owner = await prisma.user.findFirst({
      where: { id: parsed.data.ownerUserId, role: "ADVISOR", deletedAt: null },
      select: {
        id: true,
        advisorProfile: { select: { id: true, enterpriseId: true } },
        enterpriseMembership: { select: { id: true } },
      },
    });

    if (!owner?.advisorProfile) {
      return { success: false, error: "Owner must be an active advisor with a profile" };
    }
    if (owner.enterpriseMembership) {
      return { success: false, error: "Owner already belongs to an enterprise" };
    }
    if (owner.advisorProfile.enterpriseId) {
      return { success: false, error: "Owner profile is already linked to an enterprise" };
    }

    const existingSlug = await prisma.advisorEnterprise.findUnique({
      where: { slug: parsed.data.slug },
      select: { id: true },
    });
    if (existingSlug) {
      return { success: false, error: "An enterprise with this slug already exists" };
    }

    const seatLimit = parsed.data.seatLimit ?? ENTERPRISE_DEFAULT_SEAT_LIMIT;
    const clientLimit = parsed.data.clientLimit ?? ENTERPRISE_DEFAULT_CLIENT_LIMIT;
    const perAdvisorClientLimit =
      parsed.data.perAdvisorClientLimit ?? ENTERPRISE_DEFAULT_PER_ADVISOR_CLIENT_LIMIT;
    const billingCycle = parsed.data.billingCycle ?? "ANNUAL";
    const moduleTier = parsed.data.moduleTier;
    const periodEnd = new Date();
    periodEnd.setUTCFullYear(periodEnd.getUTCFullYear() + 1);

    const result = await prisma.$transaction(async (tx) => {
      const enterprise = await tx.advisorEnterprise.create({
        data: {
          name: parsed.data.name.trim(),
          slug: parsed.data.slug,
          status: "PROVISIONING",
          seatLimit,
          clientLimit,
          perAdvisorClientLimit,
          paymentMethod: parsed.data.paymentMethod,
          billingContactUserId: owner.id,
        },
      });

      await cancelSoloSubscriptionForEnterprise(
        owner.id,
        {
          reason: "enterprise_owner_provision",
          enterpriseId: enterprise.id,
        },
        tx
      );

      await tx.advisorProfile.update({
        where: { id: owner.advisorProfile!.id },
        data: { enterpriseId: enterprise.id },
      });

      const membership = await tx.enterpriseMembership.create({
        data: {
          enterpriseId: enterprise.id,
          userId: owner.id,
          advisorProfileId: owner.advisorProfile!.id,
          role: "OWNER",
          status: "ACTIVE",
          acceptedAt: new Date(),
        },
      });

      const subscription = await tx.subscription.create({
        data: {
          enterpriseId: enterprise.id,
          tier: moduleTier,
          status: "ACTIVE",
          clientLimit,
          billingCycle,
          currentPeriodEnd: periodEnd,
          stripeCustomerId: parsed.data.stripeCustomerId ?? null,
          stripeSubscriptionId: parsed.data.stripeSubscriptionId ?? null,
        },
      });

      await tx.subscriptionAuditLog.create({
        data: {
          subscriptionId: subscription.id,
          action: "admin_enterprise_provision",
          newTier: moduleTier,
          metadata: {
            enterpriseId: enterprise.id,
            paymentMethod: parsed.data.paymentMethod,
            moduleTier,
            seatLimit,
            clientLimit,
            perAdvisorClientLimit,
          },
        },
      });

      const { getSubdomainActivationData } = await import("@/lib/advisor/platform-subdomain");
      const activation = getSubdomainActivationData();
      const existingSubdomain = await tx.advisorSubdomain.findUnique({
        where: { advisorId: owner.advisorProfile!.id },
      });
      if (existingSubdomain) {
        await tx.advisorSubdomain.update({
          where: { advisorId: owner.advisorProfile!.id },
          data: {
            enterpriseId: enterprise.id,
            subdomain: parsed.data.slug,
            isActive: activation.isActive,
            dnsVerified: activation.dnsVerified,
            sslProvisioned: activation.sslProvisioned,
            verifiedAt: activation.verifiedAt,
          },
        });
      } else {
        await tx.advisorSubdomain.create({
          data: {
            advisorId: owner.advisorProfile!.id,
            enterpriseId: enterprise.id,
            subdomain: parsed.data.slug,
            isActive: activation.isActive,
            dnsVerified: activation.dnsVerified,
            sslProvisioned: activation.sslProvisioned,
            verifiedAt: activation.verifiedAt,
          },
        });
      }

      return { enterprise, membership, subscription };
    });

    await writeAudit({
      actor: { userId: actorUserId, role: actorRole as UserRole, email: actorEmail },
      action: AUDIT_ACTIONS.USER_UPDATE,
      entityType: "AdvisorEnterprise",
      entityId: result.enterprise.id,
      afterData: {
        name: result.enterprise.name,
        slug: result.enterprise.slug,
        ownerUserId: owner.id,
        seatLimit,
        clientLimit,
        perAdvisorClientLimit,
        paymentMethod: parsed.data.paymentMethod,
        moduleTier,
        status: "PROVISIONING",
        provisionSubmitted: true,
      },
    });

    revalidatePath("/admin/advisors");
    revalidatePath("/admin/enterprises");
    revalidatePath("/admin");

    const provisionActor = {
      userId: actorUserId,
      email: actorEmail,
      role: actorRole as UserRole,
    };

    scheduleEnterpriseProvision(result.enterprise.id, provisionActor);

    return {
      success: true,
      queued: true,
      enterpriseId: result.enterprise.id,
      subscriptionId: result.subscription.id,
      ownerMembershipId: result.membership.id,
    };
  } catch (e) {
    logSafeError("admin/createEnterprise", e);
    return { success: false, error: safeErrorMessage(e, "Failed to create enterprise") };
  }
}

const enterpriseIdSchema = z.object({
  enterpriseId: z.string().cuid(),
});

const deleteEnterpriseSchema = enterpriseIdSchema.extend({
  confirmSlug: z.string().min(1).max(40),
});

function revalidateEnterpriseAdminPaths(enterpriseId: string) {
  revalidatePath("/admin/enterprises");
  revalidatePath(`/admin/enterprises/${enterpriseId}`);
  revalidatePath("/admin/advisors");
  revalidatePath("/admin");
}

const updateEnterpriseModuleTierSchema = enterpriseIdSchema.extend({
  moduleTier: moduleTierSchema,
  billingCycle: z.enum(["MONTHLY", "ANNUAL"]).optional(),
});

export type UpdateEnterpriseModuleTierInput = z.infer<
  typeof updateEnterpriseModuleTierSchema
>;

export async function updateEnterpriseModuleTierByAdmin(input: unknown) {
  try {
    const { userId: actorUserId, email: actorEmail, role: actorRole } =
      await requireAdminRole();
    const parsed = updateEnterpriseModuleTierSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.flatten().fieldErrors
          ? Object.values(parsed.error.flatten().fieldErrors).flat().join("; ")
          : "Validation failed",
      };
    }

    const enterprise = await prisma.advisorEnterprise.findUnique({
      where: { id: parsed.data.enterpriseId },
      select: {
        id: true,
        subscription: { select: { id: true, tier: true, billingCycle: true } },
      },
    });

    if (!enterprise?.subscription) {
      return { success: false, error: "Enterprise firm or subscription not found" };
    }

    const previousTier = enterprise.subscription.tier;
    const billingCycle =
      parsed.data.billingCycle ?? enterprise.subscription.billingCycle;

    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: enterprise.subscription!.id },
        data: {
          tier: parsed.data.moduleTier,
          billingCycle,
        },
      });

      await tx.subscriptionAuditLog.create({
        data: {
          subscriptionId: enterprise.subscription!.id,
          action: "admin_enterprise_tier_update",
          previousTier,
          newTier: parsed.data.moduleTier,
          metadata: {
            enterpriseId: enterprise.id,
            billingCycle,
            actorUserId,
          },
        },
      });
    });

    await writeAudit({
      actor: { userId: actorUserId, role: actorRole as UserRole, email: actorEmail },
      action: AUDIT_ACTIONS.USER_UPDATE,
      entityType: "AdvisorEnterprise",
      entityId: enterprise.id,
      afterData: {
        moduleTier: parsed.data.moduleTier,
        billingCycle,
        previousTier,
      },
    });

    revalidateEnterpriseAdminPaths(parsed.data.enterpriseId);
    revalidatePath("/advisor/billing");
    revalidatePath("/advisor/enterprise/pricing");

    return { success: true as const };
  } catch (e) {
    logSafeError("admin/updateEnterpriseModuleTier", e);
    return {
      success: false,
      error: safeErrorMessage(e, "Failed to update module tier"),
    };
  }
}

export async function retryEnterpriseProvisionByAdmin(input: unknown) {
  try {
    const { userId, email, role } = await requireAdminRole();
    const parsed = enterpriseIdSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.flatten().fieldErrors
          ? Object.values(parsed.error.flatten().fieldErrors).flat().join("; ")
          : "Validation failed",
      };
    }

    const enterprise = await prisma.advisorEnterprise.findUnique({
      where: { id: parsed.data.enterpriseId },
      select: { id: true, status: true },
    });
    if (!enterprise) {
      return { success: false, error: "Enterprise not found" };
    }
    if (enterprise.status !== "PROVISIONING") {
      return {
        success: false,
        error: "Provisioning can only be retried while the firm is still provisioning",
      };
    }

    const actor = { userId, email, role: role as UserRole };
    const queued = await queueEnterpriseProvision(parsed.data.enterpriseId, actor);
    revalidateEnterpriseAdminPaths(parsed.data.enterpriseId);
    return { success: true as const, queued: true, mode: queued.mode };
  } catch (e) {
    logSafeError("admin/retryEnterpriseProvision", e);
    return {
      success: false,
      error: safeErrorMessage(e, "Failed to retry provisioning"),
    };
  }
}

export async function suspendEnterpriseByAdmin(input: unknown) {
  try {
    const { userId, email, role } = await requireAdminRole();
    const parsed = enterpriseIdSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.flatten().fieldErrors
          ? Object.values(parsed.error.flatten().fieldErrors).flat().join("; ")
          : "Validation failed",
      };
    }

    await suspendEnterpriseFirmByAdmin({
      enterpriseId: parsed.data.enterpriseId,
      actor: { userId, email, role },
    });
    revalidateEnterpriseAdminPaths(parsed.data.enterpriseId);
    return { success: true as const };
  } catch (e) {
    if (e instanceof EnterpriseLifecycleError) {
      return { success: false, error: e.message };
    }
    logSafeError("admin/suspendEnterprise", e);
    return { success: false, error: safeErrorMessage(e, "Failed to suspend firm") };
  }
}

export async function reactivateEnterpriseByAdmin(input: unknown) {
  try {
    const { userId, email, role } = await requireAdminRole();
    const parsed = enterpriseIdSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.flatten().fieldErrors
          ? Object.values(parsed.error.flatten().fieldErrors).flat().join("; ")
          : "Validation failed",
      };
    }

    await reactivateEnterpriseFirmByAdmin({
      enterpriseId: parsed.data.enterpriseId,
      actor: { userId, email, role },
    });
    revalidateEnterpriseAdminPaths(parsed.data.enterpriseId);
    return { success: true as const };
  } catch (e) {
    if (e instanceof EnterpriseLifecycleError) {
      return { success: false, error: e.message };
    }
    logSafeError("admin/reactivateEnterprise", e);
    return { success: false, error: safeErrorMessage(e, "Failed to reactivate firm") };
  }
}

export async function deleteEnterpriseByAdmin(input: unknown) {
  try {
    const { userId, email, role } = await requireAdminRole();
    const parsed = deleteEnterpriseSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.flatten().fieldErrors
          ? Object.values(parsed.error.flatten().fieldErrors).flat().join("; ")
          : "Validation failed",
      };
    }

    await deleteEnterpriseFirmByAdmin({
      enterpriseId: parsed.data.enterpriseId,
      confirmSlug: parsed.data.confirmSlug,
      actor: { userId, email, role },
    });
    revalidateEnterpriseAdminPaths(parsed.data.enterpriseId);
    return { success: true as const };
  } catch (e) {
    if (e instanceof EnterpriseLifecycleError) {
      return { success: false, error: e.message };
    }
    logSafeError("admin/deleteEnterprise", e);
    return { success: false, error: safeErrorMessage(e, "Failed to delete firm") };
  }
}
