import "server-only";

import type { BillingCycle } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  advisorBillingDeepLink,
  SELF_SERVE_TIERS,
  type SelfServeTier,
} from "@/lib/billing/tier-catalog";

import { ADVISOR_SUBSCRIPTION_BILLING_HREF } from "./auth";

/** Pending self-serve checkout: billing deep-link from the subscription row when possible. */
export async function resolveAdvisorCheckoutBillingHref(
  userId: string
): Promise<string> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: {
      tier: true,
      billingCycle: true,
      stripeSubscriptionId: true,
      status: true,
    },
  });

  if (
    sub &&
    !sub.stripeSubscriptionId?.trim() &&
    SELF_SERVE_TIERS.includes(sub.tier as SelfServeTier)
  ) {
    return advisorBillingDeepLink(sub.tier as SelfServeTier, sub.billingCycle);
  }

  return ADVISOR_SUBSCRIPTION_BILLING_HREF;
}

export async function resolveAdvisorCheckoutIntentForEmail(
  email: string
): Promise<{ tier: SelfServeTier; billingCycle: BillingCycle } | null> {
  const { findUserByEmail } = await import("@/lib/auth/user-email");
  const user = await findUserByEmail(email, {
    where: { deletedAt: null, role: "ADVISOR" },
    select: { id: true },
  });
  if (!user) return null;

  const sub = await prisma.subscription.findUnique({
    where: { userId: user.id },
    select: { tier: true, billingCycle: true, stripeSubscriptionId: true },
  });

  if (
    !sub ||
    sub.stripeSubscriptionId?.trim() ||
    !SELF_SERVE_TIERS.includes(sub.tier as SelfServeTier)
  ) {
    return null;
  }

  return {
    tier: sub.tier as SelfServeTier,
    billingCycle: sub.billingCycle,
  };
}
