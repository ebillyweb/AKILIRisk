"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { UserRole } from "@prisma/client";

import { prisma } from "@/lib/db";
import { requireSuperAdminRole } from "@/lib/admin/auth";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import {
  getPasswordPolicyForAdmin,
  markStaffPasswordsOutOfCompliance,
  policyRulesChanged,
} from "@/lib/platform/password-policy-settings";

const updatePasswordPolicySchema = z
  .object({
    minLength: z.number().int().min(8).max(128),
    requireUppercase: z.boolean(),
    requireNumber: z.boolean(),
    requireSpecialCharacter: z.boolean(),
    complianceNotice: z.string().max(2000).nullable(),
  })
  .refine(
    (d) =>
      d.requireUppercase ||
      d.requireNumber ||
      d.requireSpecialCharacter ||
      d.minLength >= 8,
    { message: "At least one password rule must be enabled" }
  );

const updateFlagsSchema = z.object({
  advisorGovernanceDashboardEnabled: z.boolean(),
  advisorRiskIntelligenceEnabled: z.boolean(),
  advisorWorkflowTasksEnabled: z.boolean(),
  advisorWorkflowFollowUpsEnabled: z.boolean(),
});

const updateMfaPolicySchema = z.object({
  mfaRequiredForAllRoles: z.boolean(),
});

export async function updatePlatformAdvisorFeatureFlags(input: unknown) {
  try {
    const { userId: actorUserId, email: actorEmail, role: actorRole } =
      await requireSuperAdminRole();
    const parsed = updateFlagsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Invalid feature flag payload",
      };
    }

    // Capture prior state for the audit beforeData. Defaults match the upsert's
    // create-path defaults so a first-time write still produces a useful diff.
    const prior = await prisma.platformSettings.findUnique({
      where: { id: "default" },
      select: {
        advisorGovernanceDashboardEnabled: true,
        advisorRiskIntelligenceEnabled: true,
        advisorWorkflowTasksEnabled: true,
        advisorWorkflowFollowUpsEnabled: true,
      },
    });

    await prisma.platformSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        advisorGovernanceDashboardEnabled: parsed.data.advisorGovernanceDashboardEnabled,
        advisorRiskIntelligenceEnabled: parsed.data.advisorRiskIntelligenceEnabled,
        advisorWorkflowTasksEnabled: parsed.data.advisorWorkflowTasksEnabled,
        advisorWorkflowFollowUpsEnabled: parsed.data.advisorWorkflowFollowUpsEnabled,
      },
      update: {
        advisorGovernanceDashboardEnabled: parsed.data.advisorGovernanceDashboardEnabled,
        advisorRiskIntelligenceEnabled: parsed.data.advisorRiskIntelligenceEnabled,
        advisorWorkflowTasksEnabled: parsed.data.advisorWorkflowTasksEnabled,
        advisorWorkflowFollowUpsEnabled: parsed.data.advisorWorkflowFollowUpsEnabled,
      },
    });

    await writeAudit({
      actor: { userId: actorUserId, role: actorRole as UserRole, email: actorEmail },
      action: AUDIT_ACTIONS.PLATFORM_SETTINGS_UPDATE,
      entityType: "PlatformSettings",
      entityId: "default",
      beforeData: prior ?? {
        // First-write case: capture the implicit defaults so the diff is honest.
        advisorGovernanceDashboardEnabled: true,
        advisorRiskIntelligenceEnabled: true,
        advisorWorkflowTasksEnabled: false,
        advisorWorkflowFollowUpsEnabled: false,
      },
      afterData: {
        advisorGovernanceDashboardEnabled: parsed.data.advisorGovernanceDashboardEnabled,
        advisorRiskIntelligenceEnabled: parsed.data.advisorRiskIntelligenceEnabled,
        advisorWorkflowTasksEnabled: parsed.data.advisorWorkflowTasksEnabled,
        advisorWorkflowFollowUpsEnabled: parsed.data.advisorWorkflowFollowUpsEnabled,
      },
    });

    revalidatePath("/admin/settings");
    revalidatePath("/advisor");
    revalidatePath("/advisor/dashboard");
    revalidatePath("/advisor/intelligence");

    return { success: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update settings";
    return { success: false as const, error: message };
  }
}

export async function getPlatformAdvisorFeatureFlagsForAdmin() {
  try {
    await requireSuperAdminRole();
    const row = await prisma.platformSettings.findUnique({
      where: { id: "default" },
    });
    if (!row) {
      return {
        success: true as const,
        data: {
          advisorGovernanceDashboardEnabled: true,
          advisorRiskIntelligenceEnabled: true,
          advisorWorkflowTasksEnabled: false,
          advisorWorkflowFollowUpsEnabled: false,
          mfaRequiredForAllRoles: false,
        },
      };
    }
    return {
      success: true as const,
      data: {
        advisorGovernanceDashboardEnabled: row.advisorGovernanceDashboardEnabled,
        advisorRiskIntelligenceEnabled: row.advisorRiskIntelligenceEnabled,
        advisorWorkflowTasksEnabled: row.advisorWorkflowTasksEnabled,
        advisorWorkflowFollowUpsEnabled: row.advisorWorkflowFollowUpsEnabled,
        mfaRequiredForAllRoles: row.mfaRequiredForAllRoles,
      },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load settings";
    return { success: false as const, error: message };
  }
}

export async function updatePlatformMfaPolicy(input: unknown) {
  try {
    const { userId: actorUserId, email: actorEmail, role: actorRole } =
      await requireSuperAdminRole();
    const parsed = updateMfaPolicySchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Invalid MFA policy payload",
      };
    }

    if (parsed.data.mfaRequiredForAllRoles) {
      return {
        success: false as const,
        error:
          "Platform-wide MFA requirement is disabled. Users enable MFA from Settings when they choose to.",
      };
    }

    const prior = await prisma.platformSettings.findUnique({
      where: { id: "default" },
      select: { mfaRequiredForAllRoles: true },
    });

    await prisma.platformSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        mfaRequiredForAllRoles: parsed.data.mfaRequiredForAllRoles,
      },
      update: {
        mfaRequiredForAllRoles: parsed.data.mfaRequiredForAllRoles,
      },
    });

    await writeAudit({
      actor: { userId: actorUserId, role: actorRole as UserRole, email: actorEmail },
      action: AUDIT_ACTIONS.PLATFORM_SETTINGS_UPDATE,
      entityType: "PlatformSettings",
      entityId: "default",
      beforeData: prior ?? { mfaRequiredForAllRoles: false },
      afterData: parsed.data,
      metadata: { section: "mfa_policy" },
    });

    revalidatePath("/admin/settings");

    return { success: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update MFA policy";
    return { success: false as const, error: message };
  }
}

// ── A2: Risk-tier thresholds (BRD §4.2 + §7.1) ────────────────────────────

/**
 * Schema mirrors the three configurable cutoffs on PlatformSettings.
 *
 * Validation:
 *   - Each integer in [0, 100].
 *   - Strictly monotonic decreasing: lowMin > mediumMin > highMin.
 *     (riskLevelFromResiliencePercent cascades top-down — non-monotonic
 *     values would still produce defined output but the semantics break.)
 *   - No minimum spacing enforced; admins can pick any monotonic triple.
 */
const updateRiskThresholdsSchema = z
  .object({
    lowMin: z.number().int().min(0).max(100),
    mediumMin: z.number().int().min(0).max(100),
    highMin: z.number().int().min(0).max(100),
  })
  .refine((d) => d.lowMin > d.mediumMin && d.mediumMin > d.highMin, {
    message:
      "Thresholds must be strictly decreasing: Low > Medium > High (e.g., 80 / 60 / 40).",
  });

export type UpdateRiskThresholdsInput = z.infer<typeof updateRiskThresholdsSchema>;

export async function updateRiskThresholds(input: unknown) {
  try {
    const { userId: actorUserId, email: actorEmail, role: actorRole } =
      await requireSuperAdminRole();
    const parsed = updateRiskThresholdsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false as const,
        error:
          parsed.error.issues[0]?.message ?? "Invalid threshold payload",
      };
    }

    // Capture prior state for the audit beforeData. Defaults match the upsert's
    // create-path defaults (the original 80/60/40 hardcoded bands).
    const prior = await prisma.platformSettings.findUnique({
      where: { id: "default" },
      select: {
        riskThresholdLow: true,
        riskThresholdMedium: true,
        riskThresholdHigh: true,
      },
    });

    await prisma.platformSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        riskThresholdLow: parsed.data.lowMin,
        riskThresholdMedium: parsed.data.mediumMin,
        riskThresholdHigh: parsed.data.highMin,
      },
      update: {
        riskThresholdLow: parsed.data.lowMin,
        riskThresholdMedium: parsed.data.mediumMin,
        riskThresholdHigh: parsed.data.highMin,
      },
    });

    await writeAudit({
      actor: { userId: actorUserId, role: actorRole as UserRole, email: actorEmail },
      action: AUDIT_ACTIONS.RISK_THRESHOLDS_UPDATE,
      entityType: "PlatformSettings",
      entityId: "default",
      beforeData: prior
        ? {
            lowMin: prior.riskThresholdLow,
            mediumMin: prior.riskThresholdMedium,
            highMin: prior.riskThresholdHigh,
          }
        : { lowMin: 80, mediumMin: 60, highMin: 40 },
      afterData: {
        lowMin: parsed.data.lowMin,
        mediumMin: parsed.data.mediumMin,
        highMin: parsed.data.highMin,
      },
      // Documented in the admin form helper text and the migration comment:
      // PillarScore.riskLevel is a persisted column. Existing scored rows
      // are NOT retroactively recomputed; threshold changes apply to NEW
      // scoring runs only.
      metadata: { appliesTo: "new_scoring_runs_only" },
    });

    revalidatePath("/admin/scoring/thresholds");
    revalidatePath("/admin/settings");

    return { success: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update risk thresholds";
    return { success: false as const, error: message };
  }
}

export async function getRiskThresholdsForAdmin() {
  try {
    await requireSuperAdminRole();
    const row = await prisma.platformSettings.findUnique({
      where: { id: "default" },
      select: {
        riskThresholdLow: true,
        riskThresholdMedium: true,
        riskThresholdHigh: true,
      },
    });
    if (!row) {
      return {
        success: true as const,
        data: { lowMin: 80, mediumMin: 60, highMin: 40 },
      };
    }
    return {
      success: true as const,
      data: {
        lowMin: row.riskThresholdLow,
        mediumMin: row.riskThresholdMedium,
        highMin: row.riskThresholdHigh,
      },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load risk thresholds";
    return { success: false as const, error: message };
  }
}

export async function getPasswordPolicyForSuperAdmin() {
  await requireSuperAdminRole();
  return getPasswordPolicyForAdmin();
}

export async function updatePasswordPolicy(input: unknown) {
  try {
    const { userId: actorUserId, email: actorEmail, role: actorRole } =
      await requireSuperAdminRole();
    const parsed = updatePasswordPolicySchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false as const,
        error: parsed.error.issues[0]?.message ?? "Invalid password policy",
      };
    }

    const prior = await getPasswordPolicyForAdmin();
    const rulesChanged = policyRulesChanged(prior, parsed.data);
    const nextRevision = rulesChanged
      ? prior.revision + 1
      : prior.revision;

    await prisma.platformSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        passwordMinLength: parsed.data.minLength,
        passwordRequireUppercase: parsed.data.requireUppercase,
        passwordRequireNumber: parsed.data.requireNumber,
        passwordRequireSpecialCharacter: parsed.data.requireSpecialCharacter,
        passwordPolicyRevision: nextRevision,
        passwordComplianceNotice: parsed.data.complianceNotice,
      },
      update: {
        passwordMinLength: parsed.data.minLength,
        passwordRequireUppercase: parsed.data.requireUppercase,
        passwordRequireNumber: parsed.data.requireNumber,
        passwordRequireSpecialCharacter: parsed.data.requireSpecialCharacter,
        passwordPolicyRevision: nextRevision,
        passwordComplianceNotice: parsed.data.complianceNotice,
      },
    });

    let affectedUsers = 0;
    if (rulesChanged || parsed.data.complianceNotice !== prior.complianceNotice) {
      affectedUsers = await markStaffPasswordsOutOfCompliance();
    }

    await writeAudit({
      actor: { userId: actorUserId, role: actorRole as UserRole, email: actorEmail },
      action: AUDIT_ACTIONS.PLATFORM_SETTINGS_UPDATE,
      entityType: "PlatformSettings",
      entityId: "default",
      beforeData: prior,
      afterData: {
        ...parsed.data,
        revision: nextRevision,
      },
      metadata: {
        section: "password_policy",
        rulesChanged,
        affectedUsers,
      },
    });

    revalidatePath("/admin/settings");

    return {
      success: true as const,
      affectedUsers,
      revision: nextRevision,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update password policy";
    return { success: false as const, error: message };
  }
}
