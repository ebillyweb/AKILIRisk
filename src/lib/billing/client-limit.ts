import type { SubscriptionTier } from "@prisma/client";

import { TIER_LIMITS } from "@/lib/billing/constants";
import {
  advisorBillingDeepLink,
  TIER_DISPLAY_NAME,
  SELF_SERVE_TIERS,
  TIER_RANK,
  type SelfServeTier,
} from "@/lib/billing/tier-catalog";

export type ClientLimitSnapshot = {
  canAddClient: boolean;
  currentCount: number;
  limit: number;
  currentTier: SubscriptionTier;
  suggestedUpgradeTier: SelfServeTier | null;
  isEnterprise: boolean;
  canSelfServeUpgrade: boolean;
};

/** Next self-serve tier with a higher client cap than the current tier. */
export function suggestedTierForMoreClients(
  currentTier: SubscriptionTier
): SelfServeTier | null {
  const currentLimit = TIER_LIMITS[currentTier] ?? TIER_LIMITS.ESSENTIALS;
  for (const tier of SELF_SERVE_TIERS) {
    if (TIER_LIMITS[tier] > currentLimit) {
      return tier;
    }
  }
  return null;
}

export function clientLimitUsageLabel(currentCount: number, limit: number): string {
  return `${currentCount} / ${limit} clients`;
}

export function clientLimitUpgradeMessage(status: ClientLimitSnapshot): string {
  if (status.canAddClient) {
    return `${clientLimitUsageLabel(status.currentCount, status.limit)} on your ${TIER_DISPLAY_NAME[status.currentTier]} plan.`;
  }

  if (status.isEnterprise) {
    return `You've reached your client allocation (${status.currentCount}/${status.limit}). Contact your firm administrator or account manager to increase capacity.`;
  }

  if (status.suggestedUpgradeTier) {
    const next = status.suggestedUpgradeTier;
    return `You've reached your plan limit (${status.currentCount}/${status.limit}). Upgrade to ${TIER_DISPLAY_NAME[next]} for up to ${TIER_LIMITS[next]} active clients.`;
  }

  return `You've reached the maximum client limit (${status.currentCount}/${status.limit}) on Platinum. Contact sales for Enterprise capacity.`;
}

export function clientLimitBillingHref(status: ClientLimitSnapshot): string {
  if (status.suggestedUpgradeTier) {
    return advisorBillingDeepLink(status.suggestedUpgradeTier, "MONTHLY");
  }
  return "/advisor/billing";
}

/** Active pipeline assignments must fit the target tier cap before checkout or downgrade. */
export function isTierWithinClientCapacity(
  currentClientCount: number,
  targetTier: SubscriptionTier
): boolean {
  return currentClientCount <= TIER_LIMITS[targetTier];
}

export function clientsOverTierCapacity(
  currentClientCount: number,
  targetTier: SubscriptionTier
): number {
  const excess = currentClientCount - TIER_LIMITS[targetTier];
  return excess > 0 ? excess : 0;
}

/** User-facing block reason when active clients exceed the selected plan limit. */
export function planTierCapacityBlockReason(args: {
  currentClientCount: number;
  targetTier: SubscriptionTier;
}): string | null {
  const { currentClientCount, targetTier } = args;
  if (isTierWithinClientCapacity(currentClientCount, targetTier)) {
    return null;
  }

  const limit = TIER_LIMITS[targetTier];
  const tierName = TIER_DISPLAY_NAME[targetTier];
  const excess = clientsOverTierCapacity(currentClientCount, targetTier);

  return `You have ${currentClientCount} active clients, but ${tierName} allows ${limit}. End ${excess} client workflow${excess === 1 ? "" : "s"} in your pipeline before selecting this plan.`;
}

export const ADVISOR_PIPELINE_HREF = "/advisor/pipeline";

export type DowngradeCapacityTierBlock = {
  tier: SelfServeTier;
  limit: number;
  workflowsToEnd: number;
};

export type DowngradeCapacityStatus = {
  showBanner: boolean;
  currentClientCount: number;
  /** Highest lower tier that is still over capacity (easiest downgrade to unlock). */
  nearestBlocked: DowngradeCapacityTierBlock | null;
  /** Lower tiers blocked by current active client count, highest tier first. */
  blockedTiers: DowngradeCapacityTierBlock[];
};

/** Summarize which self-serve downgrades are blocked by active client count. */
export function analyzeDowngradeCapacity(args: {
  currentTier: SubscriptionTier;
  currentClientCount: number;
}): DowngradeCapacityStatus {
  const { currentTier, currentClientCount } = args;
  const currentRank = TIER_RANK[currentTier] ?? 0;

  const blockedTiers = SELF_SERVE_TIERS.filter((tier) => TIER_RANK[tier] < currentRank)
    .filter((tier) => currentClientCount > TIER_LIMITS[tier])
    .map((tier) => ({
      tier,
      limit: TIER_LIMITS[tier],
      workflowsToEnd: clientsOverTierCapacity(currentClientCount, tier),
    }))
    .sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier]);

  return {
    showBanner: blockedTiers.length > 0,
    currentClientCount,
    nearestBlocked: blockedTiers[0] ?? null,
    blockedTiers,
  };
}

export function downgradeCapacityBannerMessage(status: DowngradeCapacityStatus): string | null {
  if (!status.showBanner || !status.nearestBlocked) return null;

  const { currentClientCount, nearestBlocked, blockedTiers } = status;

  if (blockedTiers.length === 1) {
    const tierName = TIER_DISPLAY_NAME[nearestBlocked.tier];
    const workflowLabel =
      nearestBlocked.workflowsToEnd === 1 ? "client workflow" : "client workflows";
    return `You have ${currentClientCount} active clients. End ${nearestBlocked.workflowsToEnd} ${workflowLabel} in Pipeline before downgrading to ${tierName} (${nearestBlocked.limit} clients).`;
  }

  const parts = blockedTiers.map((row) => {
    const tierName = TIER_DISPLAY_NAME[row.tier];
    const workflowLabel = row.workflowsToEnd === 1 ? "workflow" : "workflows";
    return `${row.workflowsToEnd} ${workflowLabel} for ${tierName} (${row.limit})`;
  });

  return `You have ${currentClientCount} active clients. Some downgrades are blocked — end at least ${parts.join(", or ")}.`;
}
