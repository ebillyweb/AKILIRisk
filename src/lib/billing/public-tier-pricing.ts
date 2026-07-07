import "server-only";

import type { BillingCycle } from "@prisma/client";

import { getStripe } from "@/lib/stripe";

import { getPriceIdForTier } from "./config";
import {
  SELF_SERVE_TIERS,
  type SelfServeTier,
} from "./tier-catalog";
import { validateTierPriceEnvConfiguration } from "./tier-price-env";

const CYCLES: BillingCycle[] = ["MONTHLY", "ANNUAL"];

export type PublicTierPriceQuote = {
  amountCents: number;
  currency: string;
  /** Whole-dollar display, e.g. $149 */
  display: string;
  /** Annual plans: equivalent monthly for comparison */
  monthlyEquivalentDisplay?: string;
};

export type PublicTierPricing = {
  tier: SelfServeTier;
  monthly: PublicTierPriceQuote | null;
  annual: PublicTierPriceQuote | null;
};

export type PublicTierPricingLoadResult = {
  pricing: PublicTierPricing[];
  configErrors: string[];
};

function formatCents(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

function emptyPricing(): PublicTierPricing[] {
  return SELF_SERVE_TIERS.map((tier) => ({
    tier,
    monthly: null,
    annual: null,
  }));
}

export async function fetchPublicTierPricing(): Promise<PublicTierPricingLoadResult> {
  const configErrors = validateTierPriceEnvConfiguration();
  if (configErrors.length > 0) {
    console.error("[tier-pricing] Stripe tier price configuration errors:", configErrors);
  }

  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return { pricing: emptyPricing(), configErrors };
  }

  let stripe: ReturnType<typeof getStripe>;
  try {
    stripe = getStripe();
  } catch {
    return { pricing: emptyPricing(), configErrors };
  }

  const pricing = await Promise.all(
    SELF_SERVE_TIERS.map(async (tier) => {
      const monthly = await loadQuote(stripe, tier, "MONTHLY");
      const annual = await loadQuote(stripe, tier, "ANNUAL");
      return { tier, monthly, annual };
    })
  );

  return { pricing, configErrors };
}

async function loadQuote(
  stripe: ReturnType<typeof getStripe>,
  tier: SelfServeTier,
  cycle: BillingCycle
): Promise<PublicTierPriceQuote | null> {
  const priceId = getPriceIdForTier(tier, cycle);
  if (!priceId) return null;
  try {
    const price = await stripe.prices.retrieve(priceId);
    if (price.unit_amount == null) return null;
    const display = formatCents(price.unit_amount, price.currency);
    const quote: PublicTierPriceQuote = {
      amountCents: price.unit_amount,
      currency: price.currency,
      display,
    };
    if (cycle === "ANNUAL") {
      quote.monthlyEquivalentDisplay = formatCents(
        Math.round(price.unit_amount / 12),
        price.currency
      );
    }
    return quote;
  } catch {
    return null;
  }
}
