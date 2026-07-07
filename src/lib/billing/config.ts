import "server-only";

import type { BillingCycle, SubscriptionTier } from "@prisma/client";

import { SELF_SERVE_TIERS, tierEnvKey, type SelfServeTier } from "./tier-catalog";

export { TIER_LIMITS } from "./constants";

export type TierBillingKey = `${SubscriptionTier}_${BillingCycle}`;

/** Map configured Stripe Price IDs to tier + billing cycle (set in Dashboard). */
export function getPriceIdPlanMap(): Record<
  string,
  { tier: SubscriptionTier; billingCycle: BillingCycle }
> {
  const entries: [string, { tier: SubscriptionTier; billingCycle: BillingCycle }][] = [];

  for (const tier of SELF_SERVE_TIERS) {
    for (const billingCycle of ["MONTHLY", "ANNUAL"] as const) {
      const priceId = getPriceIdForTier(tier, billingCycle);
      if (priceId) {
        entries.push([priceId, { tier, billingCycle }]);
      }
    }
  }

  return Object.fromEntries(entries);
}

export function getPriceIdForTier(
  tier: SubscriptionTier,
  billingCycle: BillingCycle
): string | undefined {
  if (!SELF_SERVE_TIERS.includes(tier as SelfServeTier)) return undefined;
  const envKey = tierEnvKey(tier as SelfServeTier, billingCycle);
  const value = process.env[envKey]?.trim();
  return value || undefined;
}

export function isBillingEnabled(): boolean {
  return process.env.ENABLE_BILLING_FEATURES !== "false";
}

export function billingGracePeriodDays(): number {
  const raw = process.env.BILLING_GRACE_PERIOD_DAYS;
  const n = raw ? Number.parseInt(raw, 10) : 14;
  return Number.isFinite(n) && n > 0 ? n : 14;
}
