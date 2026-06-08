import { ClientPageHeader } from "@/components/layout/ClientPageHeader";
import { getClientPageHeaderConfig } from "@/components/layout/client-page-header-config";
import { getPreviewBrandHex } from "@/lib/branding/preview-hex";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

type ClientPageHeaderSlotProps = {
  pathname: string;
  intakeWaived?: boolean;
  branding?: AdvisorBrandingData | null;
};

/** Server-rendered client section header (branding + optional intake waiver copy). */
export function ClientPageHeaderSlot({
  pathname,
  intakeWaived = false,
  branding = null,
}: ClientPageHeaderSlotProps) {
  const config = getClientPageHeaderConfig(pathname, {
    intakeWaivedOnLanding: intakeWaived,
  });
  if (!config) return null;

  const brandHex = branding ? getPreviewBrandHex(branding) : null;
  return <ClientPageHeader {...config} brandHex={brandHex} />;
}
