import "server-only";

import type {
  EnterpriseRole,
  Subscription,
  SubscriptionStatus,
} from "@prisma/client";

import { prisma } from "@/lib/db";

export type BillingSubscriptionSnapshot = Pick<
  Subscription,
  | "status"
  | "currentPeriodEnd"
  | "cancelAtPeriodEnd"
  | "stripeSubscriptionId"
  | "createdAt"
  | "tier"
  | "clientLimit"
>;

export type SoloBillingContext = {
  kind: "solo";
  userId: string;
  advisorProfileId: string;
  subscription: BillingSubscriptionSnapshot | null;
};

export type EnterpriseBillingContext = {
  kind: "enterprise";
  enterpriseId: string;
  role: EnterpriseRole;
  advisorProfileId: string;
  subscription: BillingSubscriptionSnapshot | null;
};

export type BillingContext = SoloBillingContext | EnterpriseBillingContext;

const subscriptionSelect = {
  status: true,
  currentPeriodEnd: true,
  cancelAtPeriodEnd: true,
  stripeSubscriptionId: true,
  createdAt: true,
  tier: true,
  clientLimit: true,
} as const;

/**
 * Resolve whether an advisor session bills against a solo User subscription
 * or the firm's Enterprise subscription (ACTIVE membership only).
 */
export async function resolveBillingContext(
  userId: string
): Promise<BillingContext | null> {
  const profile = await prisma.advisorProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) {
    return null;
  }

  const membership = await prisma.enterpriseMembership.findFirst({
    where: { userId, status: "ACTIVE" },
    select: {
      role: true,
      enterprise: {
        select: {
          id: true,
          status: true,
          subscription: { select: subscriptionSelect },
        },
      },
    },
  });

  if (membership) {
    if (membership.enterprise.status === "SUSPENDED") {
      return {
        kind: "enterprise",
        enterpriseId: membership.enterprise.id,
        role: membership.role,
        advisorProfileId: profile.id,
        subscription: null,
      };
    }

    return {
      kind: "enterprise",
      enterpriseId: membership.enterprise.id,
      role: membership.role,
      advisorProfileId: profile.id,
      subscription: membership.enterprise.subscription,
    };
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: subscriptionSelect,
  });

  return {
    kind: "solo",
    userId,
    advisorProfileId: profile.id,
    subscription,
  };
}

/** Subscription row used for portal entitlement checks. */
export function subscriptionForPortalFromContext(
  ctx: BillingContext
): {
  status: SubscriptionStatus;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string | null;
  createdAt: Date;
} | null {
  const sub = ctx.subscription;
  if (!sub) return null;
  return {
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    stripeSubscriptionId: sub.stripeSubscriptionId,
    createdAt: sub.createdAt,
  };
}
