/**
 * US-1B: resolves how an advisor invitation email should look based on
 * brandingEnabled and subscription entitlements.
 */

import { resolveBrandingLogoS3Key } from "@/lib/branding/advisor-logo-display";

export const PLATFORM_INVITATION_CTA_COLOR = "#18181b";

export type InvitationEmailTheme = {
  brandingEnabled: boolean;
  /** When false, logo must not appear even if profile still has logoUrl. */
  showAdvisorLogo: boolean;
  logoUrl?: string;
  /** Resolved at send time (CID for private S3 logos, HTTPS for public URLs). */
  logoEmailSrc?: string;
  /** CTA button + accent border; platform default when branding off or no advanced color. */
  accentColor: string;
  /** Short line when branding is off. */
  showPlatformAttribution: boolean;
};

export type InvitationEmailThemeInput = {
  brandingEnabled: boolean;
  advancedBrandingEnabled: boolean;
  logoUrl?: string | null;
  logoS3Key?: string | null;
  primaryColor?: string | null;
};

function isValidHttpsLogoUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    return new URL(url.trim()).protocol === "https:";
  } catch {
    return false;
  }
}

function isHexColor(value: string | null | undefined): boolean {
  return !!value && /^#[0-9A-Fa-f]{6}$/.test(value.trim());
}

export function resolveInvitationEmailTheme(
  input: InvitationEmailThemeInput
): InvitationEmailTheme {
  if (!input.brandingEnabled) {
    return {
      brandingEnabled: false,
      showAdvisorLogo: false,
      accentColor: PLATFORM_INVITATION_CTA_COLOR,
      showPlatformAttribution: true,
    };
  }

  const logoUrl = isValidHttpsLogoUrl(input.logoUrl)
    ? input.logoUrl!.trim()
    : undefined;
  const hasStoredLogo = Boolean(
    resolveBrandingLogoS3Key({
      logoS3Key: input.logoS3Key,
      logoUrl: input.logoUrl,
    }) || logoUrl
  );

  const accentColor =
    input.advancedBrandingEnabled &&
    isHexColor(input.primaryColor)
      ? input.primaryColor!.trim()
      : PLATFORM_INVITATION_CTA_COLOR;

  return {
    brandingEnabled: true,
    showAdvisorLogo: hasStoredLogo,
    logoUrl,
    accentColor,
    showPlatformAttribution: false,
  };
}
