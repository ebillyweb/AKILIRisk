import "server-only";

import type { SubscriptionStatus } from "@prisma/client";

import type { DbLike } from "@/lib/billing/subscription-service";
import { prisma } from "@/lib/db";

export type CancelSoloSubscriptionReason =
  | "enterprise_owner_provision"
  | "enterprise_team_join";

export type CancelSoloSubscriptionResult = {
  cancelled: boolean;
  subscriptionId: string | null;
  stripeSubscriptionId: string | null;
  previousStatus: SubscriptionStatus | null;
};

/**
 * Mark the user's solo Subscription row cancelled when they join a firm.
 * Does not call Stripe — use {@link cancelStripeSubscriptionBestEffort} after commit.
 */
export async function cancelSoloSubscriptionForEnterprise(
  userId: string,
  options: {
    reason: CancelSoloSubscriptionReason;
    enterpriseId?: string;
    metadata?: Record<string, unknown>;
  },
  db: DbLike = prisma
): Promise<CancelSoloSubscriptionResult> {
  const sub = await db.subscription.findUnique({
    where: { userId },
    select: {
      id: true,
      status: true,
      stripeSubscriptionId: true,
    },
  });

  if (!sub) {
    return {
      cancelled: false,
      subscriptionId: null,
      stripeSubscriptionId: null,
      previousStatus: null,
    };
  }

  if (sub.status === "CANCELLED" && !sub.stripeSubscriptionId?.trim()) {
    return {
      cancelled: false,
      subscriptionId: sub.id,
      stripeSubscriptionId: null,
      previousStatus: sub.status,
    };
  }

  const previousStatus = sub.status;
  const stripeSubscriptionId = sub.stripeSubscriptionId?.trim() || null;

  await db.subscription.update({
    where: { id: sub.id },
    data: {
      status: "CANCELLED",
      cancelAtPeriodEnd: false,
    },
  });

  await db.subscriptionAuditLog.create({
    data: {
      subscriptionId: sub.id,
      action: `solo_cancel_${options.reason}`,
      metadata: {
        userId,
        enterpriseId: options.enterpriseId ?? null,
        previousStatus,
        ...options.metadata,
      },
    },
  });

  return {
    cancelled: true,
    subscriptionId: sub.id,
    stripeSubscriptionId,
    previousStatus,
  };
}
