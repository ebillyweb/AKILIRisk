import "server-only";

import type { EnterprisePaymentMethod, EnterpriseRole, SubscriptionTier } from "@prisma/client";

import { checkClientLimitForAdvisorProfile } from "@/lib/billing/subscription-service";
import { resolveBillingContext } from "@/lib/enterprise/billing-context";
import { countEnterpriseClients } from "@/lib/enterprise/client-limits";
import { getEnterpriseSeatUsage } from "@/lib/enterprise/seat-reporting";
import { prisma } from "@/lib/db";

export type EnterpriseBillingSummary = {
  kind: "enterprise";
  role: EnterpriseRole;
  enterpriseId: string;
  enterpriseName: string;
  paymentMethod: EnterprisePaymentMethod;
  tier: SubscriptionTier;
  status: string;
  billingCycle: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  firmClientCount: number;
  firmClientLimit: number;
  perAdvisorClientLimit: number;
  advisorClientCount: number;
  canAddClient: boolean;
  activeSeats: number;
  seatLimit: number;
  seatOverage: number;
  canManageStripePortal: boolean;
};

export async function getEnterpriseBillingSummary(
  userId: string
): Promise<EnterpriseBillingSummary | null> {
  const ctx = await resolveBillingContext(userId);
  if (!ctx || ctx.kind !== "enterprise") return null;

  const [enterprise, firmClientCount, seatUsage, limitCheck, subscription] =
    await Promise.all([
    prisma.advisorEnterprise.findUnique({
      where: { id: ctx.enterpriseId },
      select: {
        id: true,
        name: true,
        clientLimit: true,
        perAdvisorClientLimit: true,
        paymentMethod: true,
      },
    }),
    countEnterpriseClients(ctx.enterpriseId),
    getEnterpriseSeatUsage(ctx.enterpriseId),
    checkClientLimitForAdvisorProfile(ctx.advisorProfileId),
    prisma.subscription.findUnique({
      where: { enterpriseId: ctx.enterpriseId },
      select: {
        status: true,
        tier: true,
        billingCycle: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
      },
    }),
  ]);

  if (!enterprise || !seatUsage) return null;

  return {
    kind: "enterprise",
    role: ctx.role,
    enterpriseId: enterprise.id,
    enterpriseName: enterprise.name,
    paymentMethod: enterprise.paymentMethod,
    tier: subscription?.tier ?? "ENTERPRISE",
    status: subscription?.status ?? "NONE",
    billingCycle: subscription?.billingCycle ?? "ANNUAL",
    currentPeriodEnd: (subscription?.currentPeriodEnd ?? new Date()).toISOString(),
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    stripeCustomerId: subscription?.stripeCustomerId ?? null,
    stripeSubscriptionId: subscription?.stripeSubscriptionId ?? null,
    firmClientCount,
    firmClientLimit: enterprise.clientLimit,
    perAdvisorClientLimit: enterprise.perAdvisorClientLimit,
    advisorClientCount: limitCheck.currentCount,
    canAddClient: limitCheck.canAddClient,
    activeSeats: seatUsage.activeSeats,
    seatLimit: seatUsage.seatLimit,
    seatOverage: seatUsage.seatOverage,
    canManageStripePortal:
      ctx.role === "OWNER" &&
      enterprise.paymentMethod === "CARD" &&
      Boolean(subscription?.stripeCustomerId),
  };
}

export async function canAccessAdvisorBilling(userId: string): Promise<boolean> {
  const ctx = await resolveBillingContext(userId);
  if (!ctx || ctx.kind !== "enterprise") return true;
  return ctx.role === "OWNER" || ctx.role === "ADMIN";
}
