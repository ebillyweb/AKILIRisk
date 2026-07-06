import { getPreviewBrandHex } from "@/lib/branding/preview-hex";
import { clientPortalBrandingDisplayTitle } from "@/lib/client/client-portal-branding";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

export const THEME_VARIABLES = {
  ADVISOR_PRIMARY: "--advisor-primary",
  ADVISOR_PRIMARY_FOREGROUND: "--advisor-primary-foreground",
  ADVISOR_SECONDARY: "--advisor-secondary",
  ADVISOR_SECONDARY_FOREGROUND: "--advisor-secondary-foreground",
  ADVISOR_ACCENT: "--advisor-accent",
  ADVISOR_ACCENT_FOREGROUND: "--advisor-accent-foreground",
  BUTTON_PRIMARY: "--button-primary",
  BUTTON_PRIMARY_HOVER: "--button-primary-hover",
  HEADER_BACKGROUND: "--header-background",
  CARD_ACCENT: "--card-accent",
  BORDER_ACCENT: "--border-accent",
  ADVISOR_LOGO_URL: "--advisor-logo-url",
  ADVISOR_BRAND_NAME: "--advisor-brand-name",
} as const;

export function hexToHSL(hex: string): string {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.slice(0, 2), 16) / 255;
  const g = parseInt(cleanHex.slice(2, 4), 16) / 255;
  const b = parseInt(cleanHex.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (diff !== 0) {
    s = diff / (1 - Math.abs(2 * l - 1));

    switch (max) {
      case r:
        h = ((g - b) / diff + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / diff + 2) / 6;
        break;
      case b:
        h = ((r - g) / diff + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function hslToHex(hsl: string): string {
  const [h, s, l] = hsl.split(" ").map((val, idx) => {
    if (idx === 0) return parseInt(val, 10);
    return parseInt(val.replace("%", ""), 10) / 100;
  });

  const hue = h as number;
  const saturation = s as number;
  const lightness = l as number;

  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (hue >= 0 && hue < 60) {
    r = c;
    g = x;
  } else if (hue >= 60 && hue < 120) {
    r = x;
    g = c;
  } else if (hue >= 120 && hue < 180) {
    g = c;
    b = x;
  } else if (hue >= 180 && hue < 240) {
    g = x;
    b = c;
  } else if (hue >= 240 && hue < 300) {
    r = x;
    b = c;
  } else if (hue >= 300 && hue < 360) {
    r = c;
    b = x;
  }

  const red = Math.round((r + m) * 255);
  const green = Math.round((g + m) * 255);
  const blue = Math.round((b + m) * 255);

  return `#${red.toString(16).padStart(2, "0")}${green.toString(16).padStart(2, "0")}${blue.toString(16).padStart(2, "0")}`;
}

export function darkenColor(hex: string, amount: number): string {
  const hsl = hexToHSL(hex);
  const [h, s, l] = hsl.split(" ");
  const lightness = parseInt(l.replace("%", ""), 10);
  const newLightness = Math.max(0, lightness - amount);
  return hslToHex(`${h} ${s} ${newLightness}%`);
}

export function calculateContrastRatio(color1: string, color2: string): number {
  const getLuminance = (color: string): number => {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;

    const [rs, gs, bs] = [r, g, b].map((c) =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    );

    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const brighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (brighter + 0.05) / (darker + 0.05);
}

export function getSafeTextColor(backgroundColor: string): string {
  const whiteContrast = calculateContrastRatio(backgroundColor, "#ffffff");
  const blackContrast = calculateContrastRatio(backgroundColor, "#000000");
  return whiteContrast > blackContrast ? "#ffffff" : "#000000";
}

/** CSS custom properties for :root (SSR + client theme application). */
export function buildAdvisorRootThemeProperties(
  branding: AdvisorBrandingData
): Record<string, string> | null {
  const resolvedHex = getPreviewBrandHex(branding);
  if (!resolvedHex) return null;

  const primaryColor = resolvedHex.primary;
  const primaryHSL = hexToHSL(primaryColor);
  const primaryForeground = getSafeTextColor(primaryColor);
  const primaryCss = `hsl(${primaryHSL})`;
  const primaryFgCss = `hsl(${hexToHSL(primaryForeground)})`;

  const secondaryColor = resolvedHex.secondary;
  const secondaryHSL = hexToHSL(secondaryColor);
  const secondaryForeground = getSafeTextColor(secondaryColor);

  const accentColor = resolvedHex.accent;
  const accentHSL = hexToHSL(accentColor);
  const accentForeground = getSafeTextColor(accentColor);

  const props: Record<string, string> = {
    [THEME_VARIABLES.ADVISOR_PRIMARY]: primaryHSL,
    [THEME_VARIABLES.ADVISOR_PRIMARY_FOREGROUND]: hexToHSL(primaryForeground),
    [THEME_VARIABLES.BUTTON_PRIMARY]: primaryColor,
    [THEME_VARIABLES.BUTTON_PRIMARY_HOVER]: darkenColor(primaryColor, 10),
    [THEME_VARIABLES.BORDER_ACCENT]: primaryColor,
    "--primary": primaryCss,
    "--primary-foreground": primaryFgCss,
    "--ring": primaryCss,
    "--sidebar-primary": primaryCss,
    "--sidebar-primary-foreground": primaryFgCss,
    [THEME_VARIABLES.ADVISOR_SECONDARY]: secondaryHSL,
    [THEME_VARIABLES.ADVISOR_SECONDARY_FOREGROUND]: hexToHSL(secondaryForeground),
    [THEME_VARIABLES.HEADER_BACKGROUND]: secondaryColor,
    "--secondary": `hsl(${secondaryHSL})`,
    "--secondary-foreground": `hsl(${hexToHSL(secondaryForeground)})`,
    [THEME_VARIABLES.ADVISOR_ACCENT]: accentHSL,
    [THEME_VARIABLES.ADVISOR_ACCENT_FOREGROUND]: hexToHSL(accentForeground),
    [THEME_VARIABLES.CARD_ACCENT]: accentColor,
    "--accent": `hsl(${accentHSL})`,
    "--accent-foreground": `hsl(${hexToHSL(accentForeground)})`,
    "--brand": `hsl(${accentHSL})`,
    "--brand-foreground": `hsl(${hexToHSL(accentForeground)})`,
  };

  if (branding.logoUrl) {
    props[THEME_VARIABLES.ADVISOR_LOGO_URL] = `url(${branding.logoUrl})`;
  }

  if (branding.advisorFirmName?.trim() || branding.brandName?.trim()) {
    props[THEME_VARIABLES.ADVISOR_BRAND_NAME] =
      `"${clientPortalBrandingDisplayTitle(branding)}"`;
  }

  return props;
}

export function buildAdvisorRootThemeCss(branding: AdvisorBrandingData): string | null {
  const props = buildAdvisorRootThemeProperties(branding);
  if (!props) return null;

  const decl = Object.entries(props)
    .map(([key, value]) => `${key}:${value}`)
    .join(";");

  return `:root{${decl}}`;
}

/** Scoped advisor theme for in-app previews (does not mutate document :root). */
export function buildAdvisorScopedThemeCss(
  branding: AdvisorBrandingData,
  scopeSelector: string,
): string | null {
  const props = buildAdvisorRootThemeProperties(branding);
  if (!props) return null;

  const decl = Object.entries(props)
    .map(([key, value]) => `${key}:${value}`)
    .join(";");

  return `${scopeSelector}{${decl}}`;
}
