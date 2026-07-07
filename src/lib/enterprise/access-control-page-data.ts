import "server-only";

import type { SubscriptionTier } from "@prisma/client";

import { resolveBillingContext } from "@/lib/enterprise/billing-context";
import { getEnterpriseAdvisorMemberVisibilityForEnterprise } from "@/lib/enterprise/advisor-member-visibility";
import { clampVisibilityToModuleTier } from "@/lib/enterprise/advisor-member-visibility-tier";
import { clampBrandingPolicyToModuleTier } from "@/lib/enterprise/enterprise-member-branding-policy-tier";
import { getEnterpriseMemberBrandingPolicyForEnterprise } from "@/lib/enterprise/enterprise-member-branding-policy";
import { getEnterpriseClientDataPolicyForEnterprise } from "@/lib/enterprise/enterprise-client-data-policy";
import { getEnterpriseReminderEmailPolicyForEnterprise } from "@/lib/enterprise/enterprise-reminder-email-policy";
import { getEnterpriseTeamPageData } from "@/lib/enterprise/team-invite";
import { getEnterpriseHouseholdProfilesEnabled } from "@/lib/household/profiles-policy";
import { getPlatformFeatureFlags } from "@/lib/platform/feature-flags";
import type { AdvisorPlatformFeatureFlags } from "@/lib/platform/feature-flags";
import type { EnterpriseAdvisorMemberVisibility } from "@/lib/enterprise/advisor-member-visibility";
import type { EnterpriseMemberBrandingPolicy } from "@/lib/enterprise/enterprise-member-branding-policy-tier";
import type { EnterpriseClientDataPolicy } from "@/lib/enterprise/enterprise-client-data-policy";
import type { EnterpriseReminderEmailPolicy } from "@/lib/enterprise/enterprise-reminder-email-policy";

export type EnterpriseAccessControlPageData = {
  enterpriseName: string;
  memberVisibility: EnterpriseAdvisorMemberVisibility;
  memberBrandingPolicy: EnterpriseMemberBrandingPolicy;
  memberClientDataPolicy: EnterpriseClientDataPolicy;
  reminderEmailPolicy: EnterpriseReminderEmailPolicy;
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
    reminderEmailPolicy,
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
    getEnterpriseReminderEmailPolicyForEnterprise(data.enterpriseId),
    getEnterpriseHouseholdProfilesEnabled(data.enterpriseId),
  ]);

  return {
    enterpriseName: data.enterpriseName,
    memberVisibility,
    memberBrandingPolicy,
    memberClientDataPolicy,
    reminderEmailPolicy,
    householdProfilesEnabled,
    moduleTier,
    platformFlags,
  };
}
