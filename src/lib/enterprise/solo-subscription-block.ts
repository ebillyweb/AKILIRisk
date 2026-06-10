import "server-only";

import { subscriptionQualifiesForPortalEnablement } from "@/lib/billing/advisor-portal-subscription";
import { isBillingEnabled } from "@/lib/billing/config";
import { prisma } from "@/lib/db";

/**
 * True when the user has a solo Subscription row that still entitles portal use.
 * Blocks enterprise invite accept / admin attach until cancelled (spec).
 */
export async function userHasBlockingSoloSubscription(
  userId: string
): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: {
      status: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      stripeSubscriptionId: true,
      createdAt: true,
    },
  });
  if (!sub) return false;
  return subscriptionQualifiesForPortalEnablement(sub, isBillingEnabled());
}
