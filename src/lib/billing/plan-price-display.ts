import "server-only";

import type { BillingCycle, SubscriptionTier } from "@prisma/client";

import { getStripe } from "@/lib/stripe";

import { getPriceIdForTier } from "./config";
import { emptyPlanPricesForUi, type PlanPricesForUi } from "./plan-prices-ui";

import { SELF_SERVE_TIERS } from "./tier-catalog";

const TIERS = SELF_SERVE_TIERS;
const CYCLES: BillingCycle[] = ["MONTHLY", "ANNUAL"];

function formatCents(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

/**
 * Loads display strings from Stripe for each configured price id (read-only).
 * Fails soft per price if Stripe is unavailable or a price id is wrong.
 */
export async function fetchPlanPricesForUi(): Promise<PlanPricesForUi> {
  const result = emptyPlanPricesForUi();

  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return result;
  }

  let stripe: ReturnType<typeof getStripe>;
  try {
    stripe = getStripe();
  } catch {
    return result;
  }

  await Promise.all(
    TIERS.flatMap((tier) =>
      CYCLES.map(async (cycle) => {
        const priceId = getPriceIdForTier(tier, cycle);
        if (!priceId) return;
        try {
          const p = await stripe.prices.retrieve(priceId);
          if (p.unit_amount == null) return;
          const formatted = formatCents(p.unit_amount, p.currency);
          const suffix = cycle === "MONTHLY" ? "mo" : "yr";
          const line = `${formatted} / ${suffix}`;
          if (cycle === "MONTHLY") {
            result[tier].monthly = line;
          } else {
            result[tier].annual = line;
          }
        } catch {
          /* keep null */
        }
      })
    )
  );

  return result;
}
