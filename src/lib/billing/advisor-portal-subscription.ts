import type { SubscriptionStatus } from "@prisma/client";

import { newAdvisorPaidSignupDeadline } from "@/lib/billing/new-advisor-grace";

function subscriptionAllowsProductUse(
  status: SubscriptionStatus,
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: boolean
): boolean {
  if (status === "UNPAID") return false;
  if (status === "CANCELLED") {
    if (cancelAtPeriodEnd && currentPeriodEnd > new Date()) return true;
    return false;
  }
  if (status === "GRACE_PERIOD") {
    return currentPeriodEnd > new Date();
  }
  // ACTIVE: paid in good standing. PAST_DUE: Stripe dunning — keep hub access during
  // BILLING_GRACE_PERIOD_DAYS (STRIPE-SPEC § payment-failure grace) so advisors can fix billing.
  return status === "ACTIVE" || status === "PAST_DUE";
}

/** Subscription row exists and status allows advisor hub (aligned with client-limit rules). */
export function subscriptionEntitlesAdvisorPortal(
  sub: {
    status: SubscriptionStatus;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
  } | null
): boolean {
  if (!sub) return false;
  return subscriptionAllowsProductUse(sub.status, sub.currentPeriodEnd, sub.cancelAtPeriodEnd);
}

/** Paid signup window ends 30 days after the subscription row was created (US-58). */
export function paidSignupDeadlineForSubscription(sub: { createdAt: Date }): Date {
  return newAdvisorPaidSignupDeadline(sub.createdAt);
}

export function isPastPaidSignupDeadline(sub: { createdAt: Date }): boolean {
  return new Date() >= paidSignupDeadlineForSubscription(sub);
}

/** Stripe-linked subscription in a billable service state (US-58 "qualifying paid subscription"). */
export function hasQualifyingPaidStripeSubscription(sub: {
  stripeSubscriptionId: string | null;
  status: SubscriptionStatus;
}): boolean {
  if (!sub.stripeSubscriptionId?.trim()) return false;
  return sub.status === "ACTIVE" || sub.status === "PAST_DUE";
}

/**
 * Admin may turn portal on when the subscription entitles portal use. With billing on, a Stripe
 * subscription id is required for ongoing access after the new-advisor calendar grace window.
 *
 * US-58: calendar grace (`GRACE_PERIOD` until `currentPeriodEnd`) may qualify without Stripe;
 * after that window, or after the 30-day paid-signup deadline, a qualifying Stripe subscription
 * is required.
 */
export function subscriptionQualifiesForPortalEnablement(
  sub: {
    status: SubscriptionStatus;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    stripeSubscriptionId: string | null;
    createdAt: Date;
  } | null,
  billingFeaturesEnabled: boolean
): boolean {
  if (!sub || !subscriptionEntitlesAdvisorPortal(sub)) return false;
  if (!billingFeaturesEnabled) return true;

  if (hasQualifyingPaidStripeSubscription(sub)) return true;

  if (isPastPaidSignupDeadline(sub)) return false;

  return sub.status === "GRACE_PERIOD" && sub.currentPeriodEnd > new Date();
}
