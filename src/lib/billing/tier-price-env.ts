import "server-only";

import type { BillingCycle } from "@prisma/client";

import { isBillingEnabled } from "./config";
import { SELF_SERVE_TIERS, tierEnvKey, type SelfServeTier } from "./tier-catalog";

const BILLING_CYCLES: BillingCycle[] = ["MONTHLY", "ANNUAL"];

export function shouldValidateTierPriceEnv(): boolean {
  return isBillingEnabled();
}

/**
 * Validates that each self-serve tier has an explicit Stripe price env var
 * (no legacy fallbacks) and that no two tiers share the same price ID.
 */
export function validateTierPriceEnvConfiguration(): string[] {
  if (!shouldValidateTierPriceEnv()) {
    return [];
  }

  const issues: string[] = [];
  const priceIdOwners = new Map<
    string,
    { envKey: string; tier: SelfServeTier; billingCycle: BillingCycle }
  >();

  for (const tier of SELF_SERVE_TIERS) {
    for (const billingCycle of BILLING_CYCLES) {
      const envKey = tierEnvKey(tier, billingCycle);
      const priceId = process.env[envKey]?.trim();

      if (!priceId) {
        issues.push(
          `Missing ${envKey} for ${tier} (${billingCycle.toLowerCase()} billing).`
        );
        continue;
      }

      const existing = priceIdOwners.get(priceId);
      if (existing) {
        issues.push(
          `${envKey} (${tier} ${billingCycle.toLowerCase()}) uses the same Stripe price ID as ${existing.envKey} (${existing.tier} ${existing.billingCycle.toLowerCase()}): ${priceId}.`
        );
        continue;
      }

      priceIdOwners.set(priceId, { envKey, tier, billingCycle });
    }
  }

  return issues;
}
