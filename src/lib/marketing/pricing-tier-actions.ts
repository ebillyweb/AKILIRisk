import type { BillingCycle } from "@prisma/client";

import type { SubscriptionDetailsDTO } from "@/lib/actions/billing";
import {
  clientsOverTierCapacity,
  isTierWithinClientCapacity,
  planTierCapacityBlockReason,
} from "@/lib/billing/client-limit";
import {
  SELF_SERVE_TIERS,
  TIER_RANK,
  type SelfServeTier,
} from "@/lib/billing/tier-catalog";

export type CommittedPlan = {
  tier: SelfServeTier;
  billingCycle: BillingCycle;
};

export function isSelfServeTier(tier: string): tier is SelfServeTier {
  return (SELF_SERVE_TIERS as readonly string[]).includes(tier);
}

export function resolvePricingPlanChangeMode(
  subscription: SubscriptionDetailsDTO | null | undefined,
): "checkout" | "stripe_update" {
  if (!subscription?.stripeSubscriptionId?.trim() || subscription.status === "CANCELLED") {
    return "checkout";
  }
  return "stripe_update";
}

export function resolveCommittedPlan(
  subscription: SubscriptionDetailsDTO | null | undefined,
): CommittedPlan | null {
  if (!subscription || subscription.status === "NONE") return null;
  if (!isSelfServeTier(subscription.tier)) return null;
  return {
    tier: subscription.tier,
    billingCycle: subscription.billingCycle,
  };
}

export function nextSelfServeTier(tier: SelfServeTier): SelfServeTier | null {
  const index = SELF_SERVE_TIERS.indexOf(tier);
  if (index < 0 || index >= SELF_SERVE_TIERS.length - 1) return null;
  return SELF_SERVE_TIERS[index + 1] ?? null;
}

export function resolvePricingTierButtonLabel(args: {
  tier: SelfServeTier;
  billingCycle: BillingCycle;
  committedPlan: CommittedPlan | null;
  subscriptionStatus: string;
  awaitingCheckoutOnly: boolean;
}): string {
  const { tier, billingCycle, committedPlan, subscriptionStatus, awaitingCheckoutOnly } = args;
  const hasCommitted = committedPlan !== null;
  const isSameTier = hasCommitted && tier === committedPlan.tier;
  const isSamePlan =
    hasCommitted &&
    tier === committedPlan.tier &&
    billingCycle === committedPlan.billingCycle;
  const committedRank = hasCommitted ? TIER_RANK[committedPlan.tier] : -1;
  const tierRank = TIER_RANK[tier];

  if (isSamePlan && awaitingCheckoutOnly) {
    return "Add payment in Stripe";
  }
  if (isSamePlan && subscriptionStatus === "CANCELLED") {
    return "Resubscribe";
  }
  if (hasCommitted && isSameTier && !isSamePlan) {
    return "Switch billing";
  }
  if (hasCommitted && tierRank > committedRank) {
    return "Upgrade";
  }
  if (hasCommitted && tierRank < committedRank) {
    return "Downgrade";
  }
  return "Subscribe";
}

export function resolvePricingTierButtonVariant(args: {
  tier: SelfServeTier;
  committedPlan: CommittedPlan | null;
}): "billingUpgrade" | "billingDowngrade" | "default" {
  const { tier, committedPlan } = args;
  if (!committedPlan) return "default";
  const committedRank = TIER_RANK[committedPlan.tier];
  const tierRank = TIER_RANK[tier];
  if (tierRank > committedRank) return "billingUpgrade";
  if (tierRank < committedRank) return "billingDowngrade";
  return "default";
}

export function resolvePricingTierCapacityBlock(args: {
  tier: SelfServeTier;
  currentClientCount: number;
  committedPlan: CommittedPlan | null;
  billingCycle: BillingCycle;
}): {
  blocked: boolean;
  reason: string | null;
  clientsOverLimit: number;
} {
  const { tier, currentClientCount, committedPlan, billingCycle } = args;
  const isSameTierSwitch =
    committedPlan !== null &&
    tier === committedPlan.tier &&
    billingCycle !== committedPlan.billingCycle;

  if (isSameTierSwitch) {
    return { blocked: false, reason: null, clientsOverLimit: 0 };
  }

  if (isTierWithinClientCapacity(currentClientCount, tier)) {
    return { blocked: false, reason: null, clientsOverLimit: 0 };
  }

  return {
    blocked: true,
    reason: planTierCapacityBlockReason({ currentClientCount, targetTier: tier }),
    clientsOverLimit: clientsOverTierCapacity(currentClientCount, tier),
  };
}
