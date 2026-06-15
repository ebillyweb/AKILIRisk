import "server-only";

import { prisma } from "@/lib/db";

const PLATFORM_SETTINGS_ID = "default";

export type AdvisorPlatformFeatureFlags = {
  governanceDashboardEnabled: boolean;
  riskIntelligenceEnabled: boolean;
  workflowTasksEnabled: boolean;
  workflowFollowUpsEnabled: boolean;
};

/**
 * Global advisor-facing feature toggles (Admin → Settings).
 * Ensures a row exists after deploy (migration also seeds `default`).
 */
export async function getPlatformFeatureFlags(): Promise<AdvisorPlatformFeatureFlags> {
  const delegate = prisma.platformSettings as
    | typeof prisma.platformSettings
    | undefined;
  if (!delegate?.findUnique) {
    console.warn(
      "[feature-flags] PlatformSettings unavailable (run `npx prisma generate` and restart dev, or apply migrations). Using defaults (both enabled).",
    );
    return {
      governanceDashboardEnabled: true,
      riskIntelligenceEnabled: true,
      workflowTasksEnabled: false,
      workflowFollowUpsEnabled: false,
    };
  }

  let row = await delegate.findUnique({
    where: { id: PLATFORM_SETTINGS_ID },
  });

  if (!row) {
    row = await delegate.create({
      data: {
        id: PLATFORM_SETTINGS_ID,
        advisorGovernanceDashboardEnabled: true,
        advisorRiskIntelligenceEnabled: true,
        advisorWorkflowTasksEnabled: false,
        advisorWorkflowFollowUpsEnabled: false,
      },
    });
  }

  return {
    governanceDashboardEnabled: row.advisorGovernanceDashboardEnabled,
    riskIntelligenceEnabled: row.advisorRiskIntelligenceEnabled,
    workflowTasksEnabled: row.advisorWorkflowTasksEnabled,
    workflowFollowUpsEnabled: row.advisorWorkflowFollowUpsEnabled,
  };
}
