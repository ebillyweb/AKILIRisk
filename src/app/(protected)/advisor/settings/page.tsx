import { getAdvisorDashboardData } from "@/lib/actions/advisor-actions";
import { getAdvisorSubdomainSettings } from "@/lib/advisor/subdomain";
import {
  getProductionDomain,
  getTenantSubdomainSuffix,
  isSubdomainAutoActivateEnabled,
} from "@/lib/advisor/platform-subdomain";
import {
  getStagingPlatformHostname,
  usesStagingTenantPathPortals,
} from "@/lib/advisor/tenant-path-portals";
import {
  getSubscriptionFeatures,
  ESSENTIALS_SUBSCRIPTION_FEATURES,
} from "@/lib/subscription/validation";
import { loadAdvisorBrandingSettingsView } from "@/lib/enterprise/branding-access";
import { resolveAdvisorPersonalNameFields } from "@/lib/advisor/advisor-workspace-label";
import { AdvisorScreenHeader } from "@/components/advisor/layout/AdvisorScreenHeader";
import {
  AdvisorSettingsTabs,
} from "@/components/advisor/settings/AdvisorSettingsTabs";
import { parseAdvisorSettingsTab } from "@/lib/advisor/settings-tabs";
import { auth } from "@/lib/auth";

const ADVISOR_SETTINGS_CALLBACK = "/advisor/settings?tab=security";

export default async function AdvisorSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const initialTab = parseAdvisorSettingsTab(resolvedSearchParams.tab);

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

  const brandingSettings = await loadAdvisorBrandingSettingsView(profile.userId, profile.id);

  const currentSubdomain = await getAdvisorSubdomainSettings(profile.id);
  const productionDomain = getProductionDomain() ?? "akilirisk.com";
  const tenantSubdomainSuffix = getTenantSubdomainSuffix();
  const useTenantPathPortals = usesStagingTenantPathPortals();
  const stagingPlatformHost =
    getStagingPlatformHostname() ?? `preview.${productionDomain}`;
  const platformSubdomainsAutoActivate = isSubdomainAutoActivateEnabled();

  // Subscription flags gate premium tabs; missing Subscription row should not hide the full branding UI
  const features =
    (await getSubscriptionFeatures(profile.userId)) ?? ESSENTIALS_SUBSCRIPTION_FEATURES;

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
        description="Manage your profile, client-facing branding, and account security."
      />

      <AdvisorSettingsTabs
        initialTab={initialTab}
        profileInitialData={profileInitialData}
        firmNameReadOnly={brandingSettings.readOnly}
        brandingProfile={brandingSettings.profile}
        brandingReadOnly={brandingSettings.readOnly}
        brandingReadOnlyNotice={brandingSettings.readOnlyNotice}
        features={features}
        currentSubdomain={currentSubdomain}
        productionDomain={productionDomain}
        tenantSubdomainSuffix={tenantSubdomainSuffix}
        useTenantPathPortals={useTenantPathPortals}
        stagingPlatformHost={stagingPlatformHost}
        platformSubdomainsAutoActivate={platformSubdomainsAutoActivate}
        passwordChangeRequired={passwordChangeRequired}
        changePasswordHref={changePasswordHref}
        householdProfilesEnabled={profile.householdProfilesEnabled ?? true}
      />
    </div>
  );
}
