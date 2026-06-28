import type { SubscriptionTier } from "@prisma/client";

import type { SelfServeTier } from "@/lib/billing/tier-catalog";

/**
 * Per-tier client limit. Authoritative cap for enforcement and UI — also
 * populates Subscription.clientLimit on row create/update. Reads resolve
 * from tier via `clientLimitForTier()` so stale denormalized rows (e.g.
 * legacy 10-cap Essentials fixtures) cannot under-report capacity.
 *
 * Round-9: aligned with BRD §10.1 (25 / 50 / 100). Was 10 / 25 / 75 from
 * STRIPE-SPEC.md's original rollout. See migration
 * `20260504200000_tier_limit_bump_brd_alignment` for the existing-rows update.
 */
export const TIER_LIMITS: Record<SelfServeTier, number> = {
  ESSENTIALS: 25,
  PROFESSIONAL: 50,
  BUSINESS: 100,
  PLATINUM: 150,
};

/** Effective client cap for a subscription tier (authoritative at read time). */
export function clientLimitForTier(tier: SubscriptionTier): number {
  return TIER_LIMITS[tier as SelfServeTier] ?? TIER_LIMITS.ESSENTIALS;
}

/** Annual billing promo shown on pricing and advisor billing toggles. */
export const ANNUAL_BILLING_SAVINGS_LABEL = "2 months free";
