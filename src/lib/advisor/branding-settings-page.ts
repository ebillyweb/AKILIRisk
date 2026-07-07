import "server-only";

import { getAdvisorSubdomainSettings, getEnterpriseSubdomainSettings, type AdvisorSubdomainSettings } from "@/lib/advisor/subdomain";
import {
  getProductionDomain,
  getTenantSubdomainSuffix,
  isSubdomainAutoActivateEnabled,
} from "@/lib/advisor/platform-subdomain";
import {
  getStagingPlatformHostname,
  resolvePlatformAppOrigin,
  usesStagingTenantPathPortals,
} from "@/lib/advisor/tenant-path-portals";
import { getAdvisorDashboardData } from "@/lib/actions/advisor-actions";
import {
  loadAdvisorBrandingSettingsView,
  type AdvisorBrandingSettingsView,
} from "@/lib/enterprise/branding-access";
import {
  ESSENTIALS_SUBSCRIPTION_FEATURES,
  getSubscriptionFeatures,
} from "@/lib/subscription/validation";
import type { SubscriptionFeatures } from "@/lib/validation/branding";
import { prisma } from "@/lib/db";

export type AdvisorBrandingPageData = {
  brandingSettings: AdvisorBrandingSettingsView;
  features: SubscriptionFeatures;
  currentSubdomain: AdvisorSubdomainSettings | null;
  productionDomain: string;
  tenantSubdomainSuffix: string;
  useTenantPathPortals: boolean;
  platformAppOrigin: string;
  stagingPlatformHost: string;
  platformSubdomainsAutoActivate: boolean;
};

export async function isAdvisorBrandingNavEnabled(userId: string): Promise<boolean> {
  const profile = await prisma.advisorProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) return false;

  const view = await loadAdvisorBrandingSettingsView(userId, profile.id);
  return view.brandingTabVisible;
}

export async function loadAdvisorBrandingPageData(
  userId: string,
): Promise<
  | { success: true; data: AdvisorBrandingPageData }
  | { success: false; error: string }
  | { success: false; notFound: true }
> {
  const result = await getAdvisorDashboardData();
  if (!result.success || !result.data) {
    return { success: false, error: result.error ?? "Failed to load advisor profile." };
  }

  const { profile } = result.data;
  if (profile.userId !== userId) {
    return { success: false, error: "Advisor profile mismatch." };
  }

  const brandingSettings = await loadAdvisorBrandingSettingsView(profile.userId, profile.id);
  if (!brandingSettings.brandingTabVisible) {
    return { success: false, notFound: true };
  }

  const currentSubdomain =
    (await getAdvisorSubdomainSettings(profile.id)) ??
    (brandingSettings.context.mode !== "solo"
      ? await getEnterpriseSubdomainSettings(brandingSettings.context.enterpriseId)
      : null);

  const productionDomain = getProductionDomain() ?? "akilirisk.com";
  const tenantSubdomainSuffix = getTenantSubdomainSuffix();
  const useTenantPathPortals = usesStagingTenantPathPortals();
  const platformAppOrigin = resolvePlatformAppOrigin();
  const stagingPlatformHost =
    getStagingPlatformHostname() ?? `preview.${productionDomain}`;
  const platformSubdomainsAutoActivate = isSubdomainAutoActivateEnabled();

  const features =
    (await getSubscriptionFeatures(profile.userId)) ?? ESSENTIALS_SUBSCRIPTION_FEATURES;

  return {
    success: true,
    data: {
      brandingSettings,
      features,
      currentSubdomain,
      productionDomain,
      tenantSubdomainSuffix,
      useTenantPathPortals,
      platformAppOrigin,
      stagingPlatformHost,
      platformSubdomainsAutoActivate,
    },
  };
}
