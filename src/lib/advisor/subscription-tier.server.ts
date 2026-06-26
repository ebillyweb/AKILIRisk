import "server-only";

import type { SubscriptionTier } from "@prisma/client";

import { resolveBillingContext } from "@/lib/enterprise/billing-context";

/** Effective module tier for advisor entitlement checks (solo or enterprise subscription). */
export async function getAdvisorSubscriptionTier(userId: string): Promise<SubscriptionTier> {
  const billingCtx = await resolveBillingContext(userId);
  return billingCtx?.subscription?.tier ?? "ESSENTIALS";
}
