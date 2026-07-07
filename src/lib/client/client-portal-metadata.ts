import "server-only";

import type { Metadata } from "next";
import { brandedPortalLogoImgSrc } from "@/lib/branding/branded-portal-logo";
import {
  clientPortalBrandingDisplayTitle,
  clientPortalLogoImgSrc,
} from "@/lib/client/client-portal-branding";
import { withClientPortalLogoSrc } from "@/lib/client/resolve-client-portal-branding";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

const DEFAULT_PORTAL_DESCRIPTION =
  "Comprehensive risk assessment and family governance analysis";

function resolvePortalFavicon(
  branding: AdvisorBrandingData,
  onTenantHost: boolean,
): string | null {
  const withLogo = withClientPortalLogoSrc(branding, onTenantHost);
  if (onTenantHost) {
    return brandedPortalLogoImgSrc(withLogo);
  }
  return clientPortalLogoImgSrc(withLogo);
}

/** Browser tab title + favicon for authenticated client portal routes. */
export function buildClientPortalMetadata(
  branding: AdvisorBrandingData,
  options: {
    onTenantHost: boolean;
    pageTitle?: string | null;
  },
): Metadata {
  const brandName = clientPortalBrandingDisplayTitle(branding);
  const logoSrc = resolvePortalFavicon(branding, options.onTenantHost);
  const pageTitle = options.pageTitle?.trim();

  return {
    title: pageTitle
      ? { absolute: `${pageTitle} | ${brandName}` }
      : { absolute: brandName },
    description: branding.tagline?.trim() || DEFAULT_PORTAL_DESCRIPTION,
    ...(logoSrc ? { icons: { icon: [{ url: logoSrc }] } } : {}),
  };
}
