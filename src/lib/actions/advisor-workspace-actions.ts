"use server";

import {
  getAdvisorDashboardData,
  getAdvisorNotificationsAction,
  getPortfolioIntelligenceData,
} from "@/lib/actions/advisor-actions";
import { getClientPipelineData } from "@/lib/actions/pipeline-actions";
import { getPlatformFeatureFlags } from "@/lib/platform/feature-flags";
import {
  deriveAdvisorPriorities,
  deriveIntelligenceHighlights,
  mapNotificationsToActivity,
} from "@/lib/advisor/workspace-data";
import { getAdvisorClientLimitStatus } from "@/lib/advisor/client-limit-status.server";
import { getAdvisorSubscriptionTier } from "@/lib/advisor/subscription-tier.server";
import { requireAdvisorRole } from "@/lib/advisor/auth";

export async function getAdvisorWorkspaceHomeData() {
  const flags = await getPlatformFeatureFlags();
  const { userId } = await requireAdvisorRole();

  const [dash, pipelineRes, notificationsRes, intelligenceRes, clientLimitStatus, subscriptionTier] =
    await Promise.all([
    getAdvisorDashboardData(),
    getClientPipelineData(),
    getAdvisorNotificationsAction(),
    flags.riskIntelligenceEnabled
      ? getPortfolioIntelligenceData()
      : Promise.resolve({ success: false as const, error: "disabled" }),
    getAdvisorClientLimitStatus(userId),
    getAdvisorSubscriptionTier(userId),
  ]);

  if (!dash.success) {
    return { success: false as const, error: dash.error };
  }

  const { profile, unreadNotificationCount, pendingInvitationsCount } = dash.data!;

  const pipelineOk = pipelineRes.success;
  const clients = pipelineOk ? pipelineRes.data!.clients : [];
  const metrics = pipelineOk ? pipelineRes.data!.metrics : null;

  const priorities =
    pipelineOk && metrics
      ? deriveAdvisorPriorities(clients, metrics, pendingInvitationsCount)
      : [];

  const activity =
    notificationsRes.success
      ? mapNotificationsToActivity(notificationsRes.data ?? [])
      : [];

  const intelligenceHighlights = deriveIntelligenceHighlights(
    intelligenceRes.success ? intelligenceRes.data! : null,
    flags.riskIntelligenceEnabled
  );

  return {
    success: true as const,
    data: {
      profile,
      unreadNotificationCount,
      pendingInvitationsCount,
      pipelineOk,
      pipelineError: pipelineOk ? undefined : pipelineRes.error,
      metrics,
      priorities,
      activity,
      intelligenceHighlights,
      flags,
      clientLimitStatus,
      subscriptionTier,
    },
  };
}
