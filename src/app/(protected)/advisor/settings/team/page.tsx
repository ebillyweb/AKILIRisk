import { notFound } from "next/navigation";

import { EnterpriseTeamPanel } from "@/components/advisor/settings/EnterpriseTeamPanel";
import { requireAdvisorRole } from "@/lib/advisor/auth";
import { resolveBillingContext } from "@/lib/enterprise/billing-context";
import { getEnterpriseAdvisorMemberVisibilityForEnterprise } from "@/lib/enterprise/advisor-member-visibility";
import { clampVisibilityToModuleTier } from "@/lib/enterprise/advisor-member-visibility-tier";
import { clampBrandingPolicyToModuleTier } from "@/lib/enterprise/enterprise-member-branding-policy-tier";
import { getEnterpriseMemberBrandingPolicyForEnterprise } from "@/lib/enterprise/enterprise-member-branding-policy";
import { getEnterpriseTeamPageData } from "@/lib/enterprise/team-invite";
import { getPlatformFeatureFlags } from "@/lib/platform/feature-flags";

export default async function AdvisorTeamSettingsPage() {
  const { userId } = await requireAdvisorRole();
  const [data, billingContext, platformFlags] = await Promise.all([
    getEnterpriseTeamPageData(userId),
    resolveBillingContext(userId),
    getPlatformFeatureFlags(),
  ]);

  if (!data?.seatUsage) {
    notFound();
  }

  const moduleTier = billingContext?.subscription?.tier ?? "ESSENTIALS";

  const memberVisibility = clampVisibilityToModuleTier(
    await getEnterpriseAdvisorMemberVisibilityForEnterprise(data.enterpriseId),
    moduleTier,
  );

  const memberBrandingPolicy = clampBrandingPolicyToModuleTier(
    await getEnterpriseMemberBrandingPolicyForEnterprise(data.enterpriseId),
    moduleTier,
  );

  return (
    <EnterpriseTeamPanel
      enterpriseName={data.enterpriseName}
      role={data.role === "OWNER" ? "OWNER" : "ADMIN"}
      members={data.members}
      seatUsage={data.seatUsage}
      memberVisibility={memberVisibility}
      memberBrandingPolicy={memberBrandingPolicy}
      moduleTier={moduleTier}
      platformFlags={platformFlags}
    />
  );
}
