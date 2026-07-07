import "server-only";

import type { SubscriptionTier } from "@prisma/client";

import {
  type ClientLimitSnapshot,
  suggestedTierForMoreClients,
} from "@/lib/billing/client-limit";
import { checkClientLimitForAdvisorProfile } from "@/lib/billing/subscription-service";
import { canAccessAdvisorBilling } from "@/lib/enterprise/billing-details";
import { resolveBillingContext } from "@/lib/enterprise/billing-context";

export type { ClientLimitSnapshot };

export async function getAdvisorClientLimitStatus(
  userId: string
): Promise<ClientLimitSnapshot | null> {
  const billingCtx = await resolveBillingContext(userId);
  if (!billingCtx) {
    return null;
  }

  const [limitCheck, billingAccess] = await Promise.all([
    checkClientLimitForAdvisorProfile(billingCtx.advisorProfileId),
    canAccessAdvisorBilling(userId),
  ]);

  const currentTier: SubscriptionTier = billingCtx.subscription?.tier ?? "ESSENTIALS";
  const isEnterprise = billingCtx.kind === "enterprise";

  return {
    canAddClient: limitCheck.canAddClient,
    currentCount: limitCheck.currentCount,
    limit: limitCheck.limit,
    currentTier,
    suggestedUpgradeTier: suggestedTierForMoreClients(currentTier),
    isEnterprise,
    canSelfServeUpgrade: billingAccess,
  };
}
