import type { SubscriptionTier } from "@prisma/client";

/** Serialized plan prices for the billing UI (from Stripe Price objects). */
export type PlanPricesForUi = Record<
  SubscriptionTier,
  { monthly: string | null; annual: string | null }
>;

export function emptyPlanPricesForUi(): PlanPricesForUi {
  return {
    ESSENTIALS: { monthly: null, annual: null },
    PROFESSIONAL: { monthly: null, annual: null },
    BUSINESS: { monthly: null, annual: null },
    PLATINUM: { monthly: null, annual: null },
    ENTERPRISE: { monthly: null, annual: null },
  };
}
