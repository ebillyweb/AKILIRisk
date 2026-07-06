import { redirect } from "next/navigation";

import { getAdvisorDashboardData } from "@/lib/actions/advisor-actions";
import { resolveAdvisorPersonalNameFields } from "@/lib/advisor/advisor-workspace-label";
import { AdvisorScreenHeader } from "@/components/advisor/layout/AdvisorScreenHeader";
import { AdvisorSettingsTabs } from "@/components/advisor/settings/AdvisorSettingsTabs";
import { parseAdvisorSettingsTab } from "@/lib/advisor/settings-tabs";
import { loadAdvisorBrandingSettingsView } from "@/lib/enterprise/branding-access";
import { canAccessEnterpriseTeamSettings } from "@/lib/enterprise/team-access";
import { auth } from "@/lib/auth";

const ADVISOR_SETTINGS_CALLBACK = "/advisor/settings?tab=security";

export default async function AdvisorSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  if (resolvedSearchParams.tab === "branding") {
    redirect("/advisor/settings/branding");
  }

  const [result, session] = await Promise.all([
    getAdvisorDashboardData(),
    auth(),
  ]);

  if (!result.success) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-destructive text-sm">
            Error loading settings: {result.error}
          </p>
        </div>
      </div>
    );
  }

  const { profile } = result.data!;

  const [brandingSettings, showHouseholdProfilesPolicy] = await Promise.all([
    loadAdvisorBrandingSettingsView(profile.userId, profile.id),
    canAccessEnterpriseTeamSettings(profile.userId).then(
      (canManageTeam) => !canManageTeam,
    ),
  ]);
  const initialTab = parseAdvisorSettingsTab(resolvedSearchParams.tab);

  const passwordChangeRequired = Boolean(session?.user?.passwordChangeRequired);
  const changePasswordHref = `/change-password?callbackUrl=${encodeURIComponent(ADVISOR_SETTINGS_CALLBACK)}`;

  const { firstName, lastName } = resolveAdvisorPersonalNameFields(profile.user);

  const profileInitialData = {
    firstName,
    lastName,
    phone: profile.phone ?? "",
    jobTitle: profile.jobTitle ?? "",
    firmName:
      brandingSettings.readOnly
        ? (brandingSettings.profile.firmName ??
          brandingSettings.profile.brandName ??
          profile.firmName ??
          "")
        : (profile.firmName ?? ""),
    licenseNumber: profile.licenseNumber ?? "",
    email: profile.user.email,
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <AdvisorScreenHeader
        kicker="Professional profile"
        title="Settings"
        description="Manage your profile and account security."
      />

      <AdvisorSettingsTabs
        initialTab={initialTab}
        profileInitialData={profileInitialData}
        firmNameReadOnly={brandingSettings.readOnly}
        passwordChangeRequired={passwordChangeRequired}
        changePasswordHref={changePasswordHref}
        householdProfilesEnabled={profile.householdProfilesEnabled ?? true}
        showHouseholdProfilesPolicy={showHouseholdProfilesPolicy}
      />
    </div>
  );
}
