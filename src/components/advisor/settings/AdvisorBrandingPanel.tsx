import { ConfigurationPageHeader } from "@/components/product-tour/ConfigurationPageHeader";
import { EnhancedBrandingForm } from "@/components/advisor/settings/EnhancedBrandingForm";
import type { AdvisorBrandingPageData } from "@/lib/advisor/branding-settings-page";

type AdvisorBrandingPanelProps = {
  data: AdvisorBrandingPageData;
};

export function AdvisorBrandingPanel({ data }: AdvisorBrandingPanelProps) {
  const { brandingSettings } = data;

  return (
    <div className="space-y-5 sm:space-y-6">
      <ConfigurationPageHeader
        kicker="Firm"
        title="Brand"
        description="Logo, colors, client portal copy, and white-label subdomain for the households you serve."
        tourId="advisor-settings-branding"
      />

      <div data-tour="config-primary-form">
        <EnhancedBrandingForm
          profile={brandingSettings.profile}
          readOnly={brandingSettings.readOnly}
          readOnlyNotice={brandingSettings.readOnlyNotice}
          subdomainReadOnly={!brandingSettings.subdomainEditable}
          features={data.features}
          currentSubdomain={data.currentSubdomain}
          productionDomain={data.productionDomain}
          tenantSubdomainSuffix={data.tenantSubdomainSuffix}
          useTenantPathPortals={data.useTenantPathPortals}
          platformAppOrigin={data.platformAppOrigin}
          stagingPlatformHost={data.stagingPlatformHost}
          platformSubdomainsAutoActivate={data.platformSubdomainsAutoActivate}
        />
      </div>
    </div>
  );
}
