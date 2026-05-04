import type { SubscriptionStatus } from "@prisma/client";
import type Stripe from "stripe";

/**
 * Map Stripe's subscription status enum onto our internal one.
 *
 * Internal enum values (see prisma/schema.prisma):
 *   ACTIVE, PAST_DUE, CANCELLED, UNPAID, GRACE_PERIOD
 *
 * Entitlement helpers (`subscriptionAllowsProductUse`,
 * `subscriptionEntitlesAdvisorPortal`, etc.) treat UNPAID as the strictest
 * "no access" status, so we use that for both the explicit `incomplete`/
 * `paused` cases and the default arm. Earlier this function returned ACTIVE
 * for unknown statuses, which silently fail-OPENed any future Stripe status
 * Anthropic added.
 */
export function mapStripeSubscriptionStatus(
  status: Stripe.Subscription.Status
): SubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "unpaid":
      return "UNPAID";
    case "canceled":
    case "incomplete_expired":
      return "CANCELLED";
    case "incomplete":
      // Checkout started but the initial payment never confirmed. Treating
      // these as ACTIVE handed entitlements to anyone who opened a checkout
      // session.
      return "UNPAID";
    case "paused":
      // Stripe-paused subscriptions (admin action or payment-method issue)
      // shouldn't pass entitlement checks.
      return "UNPAID";
    default:
      // Fail closed for any future Stripe status Anthropic adds. Do NOT
      // change this back to ACTIVE without an explicit review of every
      // entitlement helper that branches on SubscriptionStatus.
      return "UNPAID";
  }
}
