/** Platform (non–advisor-branded) email identity — matches logo/README and app theme. */
export const PLATFORM_EMAIL_BRAND_NAME = "AKILI Risk Intelligence";

export const PLATFORM_EMAIL_TAGLINE = "Intelligent governance for advisory teams";

/** Brand blue — logo, links, header accent. */
export const PLATFORM_EMAIL_BRAND_BLUE = "#4EA5D9";

/** Trust accent — highlights, secondary emphasis. */
export const PLATFORM_EMAIL_TRUST_ACCENT = "#D97706";

/** Primary CTA and body headings (zinc-900). */
export const PLATFORM_EMAIL_CTA_BG = "#18181b";

export const PLATFORM_EMAIL_HEADER_GRADIENT =
  "linear-gradient(145deg,#1e293b 0%,#0f172a 55%,#172554 100%)";

/** PNG for broad email-client support (Gmail blocks SVG images). */
export const PLATFORM_EMAIL_LOGO_PATH = "/brand/akili-email-lockup.png";

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
