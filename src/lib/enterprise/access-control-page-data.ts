import "server-only";

import type { SubscriptionTier } from "@prisma/client";

import { resolveBillingContext } from "@/lib/enterprise/billing-context";
import { getEnterpriseAdvisorMemberVisibilityForEnterprise } from "@/lib/enterprise/advisor-member-visibility";
import { clampVisibilityToModuleTier } from "@/lib/enterprise/advisor-member-visibility-tier";
import { clampBrandingPolicyToModuleTier } from "@/lib/enterprise/enterprise-member-branding-policy-tier";
import { getEnterpriseMemberBrandingPolicyForEnterprise } from "@/lib/enterprise/enterprise-member-branding-policy";
import { getEnterpriseClientDataPolicyForEnterprise } from "@/lib/enterprise/enterprise-client-data-policy";
import { getEnterpriseTeamPageData } from "@/lib/enterprise/team-invite";
import { getEnterpriseHouseholdProfilesEnabled } from "@/lib/household/profiles-policy";
import { getPlatformFeatureFlags } from "@/lib/platform/feature-flags";
import type { AdvisorPlatformFeatureFlags } from "@/lib/platform/feature-flags";
import type { EnterpriseAdvisorMemberVisibility } from "@/lib/enterprise/advisor-member-visibility";
import type { EnterpriseMemberBrandingPolicy } from "@/lib/enterprise/enterprise-member-branding-policy-tier";
import type { EnterpriseClientDataPolicy } from "@/lib/enterprise/enterprise-client-data-policy";

export type EnterpriseAccessControlPageData = {
  enterpriseName: string;
  memberVisibility: EnterpriseAdvisorMemberVisibility;
  memberBrandingPolicy: EnterpriseMemberBrandingPolicy;
  memberClientDataPolicy: EnterpriseClientDataPolicy;
  householdProfilesEnabled: boolean;
  moduleTier: SubscriptionTier;
  platformFlags: AdvisorPlatformFeatureFlags;
};

export async function loadEnterpriseAccessControlPageData(
  userId: string,
): Promise<EnterpriseAccessControlPageData | null> {
  const [data, billingContext, platformFlags] = await Promise.all([
    getEnterpriseTeamPageData(userId),
    resolveBillingContext(userId),
    getPlatformFeatureFlags(),
  ]);

  if (!data?.seatUsage) {
    return null;
  }

  const moduleTier = billingContext?.subscription?.tier ?? "ESSENTIALS";

  const [
    memberVisibility,
    memberBrandingPolicy,
    memberClientDataPolicy,
    householdProfilesEnabled,
  ] = await Promise.all([
    clampVisibilityToModuleTier(
      await getEnterpriseAdvisorMemberVisibilityForEnterprise(data.enterpriseId),
      moduleTier,
    ),
    clampBrandingPolicyToModuleTier(
      await getEnterpriseMemberBrandingPolicyForEnterprise(data.enterpriseId),
      moduleTier,
    ),
    getEnterpriseClientDataPolicyForEnterprise(data.enterpriseId),
    getEnterpriseHouseholdProfilesEnabled(data.enterpriseId),
  ]);

  return {
    enterpriseName: data.enterpriseName,
    memberVisibility,
    memberBrandingPolicy,
    memberClientDataPolicy,
    householdProfilesEnabled,
    moduleTier,
    platformFlags,
  };
}
