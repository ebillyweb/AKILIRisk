"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/admin/auth";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";

const updateFlagsSchema = z.object({
  advisorGovernanceDashboardEnabled: z.boolean(),
  advisorRiskIntelligenceEnabled: z.boolean(),
});

export async function updatePlatformAdvisorFeatureFlags(input: unknown) {
  try {
    const { userId: actorUserId, email: actorEmail } = await requireAdminRole();
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
      },
    });

    await prisma.platformSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        advisorGovernanceDashboardEnabled: parsed.data.advisorGovernanceDashboardEnabled,
        advisorRiskIntelligenceEnabled: parsed.data.advisorRiskIntelligenceEnabled,
      },
      update: {
        advisorGovernanceDashboardEnabled: parsed.data.advisorGovernanceDashboardEnabled,
        advisorRiskIntelligenceEnabled: parsed.data.advisorRiskIntelligenceEnabled,
      },
    });

    await writeAudit({
      actor: { userId: actorUserId, role: "ADMIN", email: actorEmail },
      action: AUDIT_ACTIONS.PLATFORM_SETTINGS_UPDATE,
      entityType: "PlatformSettings",
      entityId: "default",
      beforeData: prior ?? {
        // First-write case: capture the implicit defaults so the diff is honest.
        advisorGovernanceDashboardEnabled: true,
        advisorRiskIntelligenceEnabled: true,
      },
      afterData: {
        advisorGovernanceDashboardEnabled: parsed.data.advisorGovernanceDashboardEnabled,
        advisorRiskIntelligenceEnabled: parsed.data.advisorRiskIntelligenceEnabled,
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
    await requireAdminRole();
    const row = await prisma.platformSettings.findUnique({
      where: { id: "default" },
    });
    if (!row) {
      return {
        success: true as const,
        data: {
          advisorGovernanceDashboardEnabled: true,
          advisorRiskIntelligenceEnabled: true,
        },
      };
    }
    return {
      success: true as const,
      data: {
        advisorGovernanceDashboardEnabled: row.advisorGovernanceDashboardEnabled,
        advisorRiskIntelligenceEnabled: row.advisorRiskIntelligenceEnabled,
      },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load settings";
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
    const { userId: actorUserId, email: actorEmail } = await requireAdminRole();
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
      actor: { userId: actorUserId, role: "ADMIN", email: actorEmail },
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
    await requireAdminRole();
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
