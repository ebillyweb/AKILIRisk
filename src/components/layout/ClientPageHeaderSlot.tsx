import { ClientPageHeader } from "@/components/layout/ClientPageHeader";
import {
  getClientPageHeaderConfig,
  type ClientPageHeaderConfig,
} from "@/components/layout/client-page-header-config";
import { getPreviewBrandHex } from "@/lib/branding/preview-hex";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

type ClientPageHeaderSlotProps = {
  pathname: string;
  intakeWaived?: boolean;
  branding?: AdvisorBrandingData | null;
};

function applyBrandingToPageHeader(
  config: ClientPageHeaderConfig,
  pathname: string,
  branding: AdvisorBrandingData | null,
): ClientPageHeaderConfig {
  if (!branding) return config;

  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    const tagline = branding.tagline?.trim();
    const landingKicker = branding.landingKicker?.trim();
    return {
      ...config,
      kicker: landingKicker || config.kicker,
      subtitle: tagline || config.subtitle,
    };
  }

  return config;
}

/** Server-rendered client section header (branding + optional intake waiver copy). */
export function ClientPageHeaderSlot({
  pathname,
  intakeWaived = false,
  branding = null,
}: ClientPageHeaderSlotProps) {
  const baseConfig = getClientPageHeaderConfig(pathname, {
    intakeWaivedOnLanding: intakeWaived,
  });
  if (!baseConfig) return null;

  const config = applyBrandingToPageHeader(baseConfig, pathname, branding);
  const brandHex = branding ? getPreviewBrandHex(branding) : null;
  return <ClientPageHeader {...config} brandHex={brandHex} />;
}
