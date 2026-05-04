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
