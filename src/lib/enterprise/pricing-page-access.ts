import "server-only";

import type { SubscriptionTier } from "@prisma/client";

import { resolveBillingContext } from "@/lib/enterprise/billing-context";
import { prisma } from "@/lib/db";

export type EnterprisePricingFirmContext = {
  enterpriseId: string;
  enterpriseName: string;
  seatLimit: number;
  firmClientLimit: number;
  perAdvisorClientLimit: number;
  paymentMethod: "CARD" | "WIRE";
  subscriptionStatus: string | null;
  hasActiveStripeSubscription: boolean;
  currentModuleTier: SubscriptionTier | null;
  contractedBillingCycle: "MONTHLY" | "ANNUAL" | null;
};

export async function getEnterprisePricingFirmContext(
  userId: string
): Promise<EnterprisePricingFirmContext | null> {
  const ctx = await resolveBillingContext(userId);
  if (!ctx || ctx.kind !== "enterprise" || ctx.role !== "OWNER") {
    return null;
  }

  const enterprise = await prisma.advisorEnterprise.findUnique({
    where: { id: ctx.enterpriseId },
    select: {
      id: true,
      name: true,
      seatLimit: true,
      clientLimit: true,
      perAdvisorClientLimit: true,
      paymentMethod: true,
      subscription: {
        select: {
          tier: true,
          status: true,
          billingCycle: true,
          stripeSubscriptionId: true,
        },
      },
    },
  });

  if (!enterprise) return null;

  const sub = enterprise.subscription;
  const hasActiveStripeSubscription = Boolean(
    sub?.stripeSubscriptionId?.trim() &&
      sub.status !== "CANCELLED" &&
      sub.status !== "UNPAID"
  );

  return {
    enterpriseId: enterprise.id,
    enterpriseName: enterprise.name,
    seatLimit: enterprise.seatLimit,
    firmClientLimit: enterprise.clientLimit,
    perAdvisorClientLimit: enterprise.perAdvisorClientLimit,
    paymentMethod: enterprise.paymentMethod,
    subscriptionStatus: sub?.status ?? null,
    hasActiveStripeSubscription,
    currentModuleTier: sub?.tier ?? null,
    contractedBillingCycle: sub?.billingCycle ?? null,
  };
}

export function enterpriseNeedsCardCheckout(
  firm: EnterprisePricingFirmContext
): boolean {
  return firm.paymentMethod === "CARD" && !firm.hasActiveStripeSubscription;
}
