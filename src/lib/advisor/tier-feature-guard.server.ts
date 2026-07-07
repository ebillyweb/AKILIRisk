import "server-only";

import type { SubscriptionTier } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { isAdvisorHubNavRole } from "@/lib/auth-roles";
import {
  type AdvisorTierFeatureKey,
  tierIncludesFeature,
} from "@/lib/billing/tier-features";

import { getAdvisorSubscriptionTier } from "./subscription-tier.server";

export type AdvisorTierFeatureAccess = {
  allowed: boolean;
  currentTier: SubscriptionTier;
};

export async function getAdvisorTierFeatureAccess(
  feature: AdvisorTierFeatureKey,
  userId?: string | null
): Promise<AdvisorTierFeatureAccess> {
  const resolvedUserId = userId ?? (await auth())?.user?.id;
  if (!resolvedUserId) {
    return { allowed: false, currentTier: "ESSENTIALS" };
  }
  const currentTier = await getAdvisorSubscriptionTier(resolvedUserId);
  return {
    allowed: tierIncludesFeature(currentTier, feature),
    currentTier,
  };
}

/** Redirects unauthenticated or non-advisor callers before evaluating tier access. */
export async function requireAdvisorTierFeatureAccess(
  feature: AdvisorTierFeatureKey
): Promise<AdvisorTierFeatureAccess> {
  const session = await auth();
  const role = session?.user?.role?.toString().toUpperCase();
  if (!session?.user?.id || !isAdvisorHubNavRole(role)) {
    redirect("/dashboard?error=unauthorized");
  }
  return getAdvisorTierFeatureAccess(feature, session.user.id);
}
