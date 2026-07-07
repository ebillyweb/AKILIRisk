import { TIER_DISPLAY_NAME, type SelfServeTier } from "@/lib/billing/tier-catalog";

/**
 * Button copy when the action only opens Billing to compare or select a plan.
 * Do not use "Upgrade" here — Stripe plan changes happen on the billing page.
 */
export function billingPlanNavigationLabel(tier?: SelfServeTier): string {
  if (tier) {
    return `View ${TIER_DISPLAY_NAME[tier]} plan`;
  }
  return "View plans";
}
