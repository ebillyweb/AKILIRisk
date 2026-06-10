import type { SubscriptionTier } from "@prisma/client";

/** Serialized plan prices for the billing UI (from Stripe Price objects). */
export type PlanPricesForUi = Record<
  SubscriptionTier,
  { monthly: string | null; annual: string | null }
>;

export function emptyPlanPricesForUi(): PlanPricesForUi {
  return {
    STARTER: { monthly: null, annual: null },
    GROWTH: { monthly: null, annual: null },
    PROFESSIONAL: { monthly: null, annual: null },
    ENTERPRISE: { monthly: null, annual: null },
  };
}
