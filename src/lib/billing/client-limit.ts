import type { SubscriptionTier } from "@prisma/client";

import { TIER_LIMITS } from "@/lib/billing/constants";
import {
  advisorBillingDeepLink,
  TIER_DISPLAY_NAME,
  SELF_SERVE_TIERS,
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
