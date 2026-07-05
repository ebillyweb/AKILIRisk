import { notFound } from "next/navigation";

import { EnterpriseAccessControlPanel } from "@/components/advisor/settings/EnterpriseAccessControlPanel";
import { requireAdvisorRole } from "@/lib/advisor/auth";
import { loadEnterpriseAccessControlPageData } from "@/lib/enterprise/access-control-page-data";

export default async function AdvisorAccessControlSettingsPage() {
  const { userId } = await requireAdvisorRole();
  const data = await loadEnterpriseAccessControlPageData(userId);

  if (!data) {
    notFound();
  }

  return (
    <EnterpriseAccessControlPanel
      enterpriseName={data.enterpriseName}
      memberVisibility={data.memberVisibility}
      memberBrandingPolicy={data.memberBrandingPolicy}
      memberClientDataPolicy={data.memberClientDataPolicy}
      householdProfilesEnabled={data.householdProfilesEnabled}
      moduleTier={data.moduleTier}
      platformFlags={data.platformFlags}
    />
  );
}
