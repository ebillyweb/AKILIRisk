/** Platform (non–advisor-branded) email identity — see `src/lib/brand/tokens.ts`. */
import {
  AKILI_BRAND,
  AKILI_EMAIL,
  AKILI_LOGO_COLORS,
  AKILI_TAGLINES,
  AKILI_UI_COLORS,
} from "@/lib/brand/tokens";

export const PLATFORM_EMAIL_BRAND_NAME = AKILI_BRAND.legalName;

export const PLATFORM_EMAIL_TAGLINE = AKILI_TAGLINES.email;

/** Brand blue — logo, links, header accent. */
export const PLATFORM_EMAIL_BRAND_BLUE = AKILI_LOGO_COLORS.brandPrimary.light;

/** Trust accent — highlights, secondary emphasis. */
export const PLATFORM_EMAIL_TRUST_ACCENT = AKILI_LOGO_COLORS.trustAccent.light;

/** Primary CTA and body headings (zinc-900). */
export const PLATFORM_EMAIL_CTA_BG = AKILI_UI_COLORS.ctaBackground;

export const PLATFORM_EMAIL_HEADER_GRADIENT = AKILI_EMAIL.headerGradient;

/** PNG for broad email-client support (Gmail blocks SVG images). */
export const PLATFORM_EMAIL_LOGO_PATH = AKILI_EMAIL.logoPublicPath;

export function resolvePlatformEmailLogoUrl(appOrigin: string | null | undefined): string {
  if (!appOrigin?.trim()) return "";
  try {
    return new URL(PLATFORM_EMAIL_LOGO_PATH, appOrigin.replace(/\/$/, "")).href;
  } catch {
    return "";
  }
}

export function platformEmailCopyrightYear(): number {
  return new Date().getFullYear();
}
