import type { SubscriptionTier } from "@prisma/client";

import type { SelfServeTier } from "@/lib/billing/tier-catalog";

/** Serialized plan prices for the billing UI (from Stripe Price objects). */
export type PlanPricesForUi = Record<
  SelfServeTier,
  { monthly: string | null; annual: string | null }
>;

export function emptyPlanPricesForUi(): PlanPricesForUi {
  return {
    ESSENTIALS: { monthly: null, annual: null },
    PROFESSIONAL: { monthly: null, annual: null },
    BUSINESS: { monthly: null, annual: null },
    PLATINUM: { monthly: null, annual: null },
  };
}

export function isModuleTier(tier: SubscriptionTier): tier is SelfServeTier {
  return tier === "ESSENTIALS" ||
    tier === "PROFESSIONAL" ||
    tier === "BUSINESS" ||
    tier === "PLATINUM";
}
