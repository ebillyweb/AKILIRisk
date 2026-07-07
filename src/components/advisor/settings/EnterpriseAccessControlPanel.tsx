import type { SubscriptionTier } from "@prisma/client";

import { ConfigurationPageHeader } from "@/components/product-tour/ConfigurationPageHeader";
import { EnterpriseAdvisorVisibilityForm } from "@/components/advisor/settings/EnterpriseAdvisorVisibilityForm";
import { EnterpriseReminderEmailPolicyForm } from "@/components/advisor/settings/EnterpriseReminderEmailPolicyForm";
import type { EnterpriseAdvisorMemberVisibility } from "@/lib/enterprise/advisor-member-visibility";
import type { EnterpriseMemberBrandingPolicy } from "@/lib/enterprise/enterprise-member-branding-policy-tier";
import type { EnterpriseClientDataPolicy } from "@/lib/enterprise/enterprise-client-data-policy";
import type { EnterpriseReminderEmailPolicy } from "@/lib/enterprise/enterprise-reminder-email-policy";
import type { AdvisorPlatformFeatureFlags } from "@/lib/platform/feature-flags";

type EnterpriseAccessControlPanelProps = {
  enterpriseName: string;
  memberVisibility: EnterpriseAdvisorMemberVisibility;
  memberBrandingPolicy: EnterpriseMemberBrandingPolicy;
  memberClientDataPolicy: EnterpriseClientDataPolicy;
  reminderEmailPolicy: EnterpriseReminderEmailPolicy;
  householdProfilesEnabled: boolean;
  moduleTier: SubscriptionTier;
  platformFlags: AdvisorPlatformFeatureFlags;
};

export function EnterpriseAccessControlPanel({
  enterpriseName,
  memberVisibility,
  memberBrandingPolicy,
  memberClientDataPolicy,
  reminderEmailPolicy,
  householdProfilesEnabled,
  moduleTier,
  platformFlags,
}: EnterpriseAccessControlPanelProps) {
  return (
    <div className="space-y-8">
      <ConfigurationPageHeader
        tourId="advisor-settings-access-control"
        title="Roles & Permissions"
        description={`Configure workspace visibility, client data defaults, and branding options for team members at ${enterpriseName}. Owners and administrators always retain full access within your module tier.`}
      />

      <EnterpriseReminderEmailPolicyForm initialPolicy={reminderEmailPolicy} />

      <EnterpriseAdvisorVisibilityForm
        initialVisibility={memberVisibility}
        initialBrandingPolicy={memberBrandingPolicy}
        initialClientDataPolicy={memberClientDataPolicy}
        initialHouseholdProfilesEnabled={householdProfilesEnabled}
        moduleTier={moduleTier}
        platformFlags={platformFlags}
      />
    </div>
  );
}
