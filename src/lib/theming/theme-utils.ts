'use client';

import { getPreviewBrandHex } from '@/lib/branding/preview-hex';
import { clientPortalBrandingDisplayTitle } from '@/lib/client/client-portal-branding';
import { AdvisorBrandingData } from '@/lib/validation/branding';

/**
 * CSS variable names for advisor theming
 */
export const THEME_VARIABLES = {
  // Brand colors
  ADVISOR_PRIMARY: '--advisor-primary',
  ADVISOR_PRIMARY_FOREGROUND: '--advisor-primary-foreground',
  ADVISOR_SECONDARY: '--advisor-secondary',
  ADVISOR_SECONDARY_FOREGROUND: '--advisor-secondary-foreground',
  ADVISOR_ACCENT: '--advisor-accent',
  ADVISOR_ACCENT_FOREGROUND: '--advisor-accent-foreground',

  // Component-specific overrides
  BUTTON_PRIMARY: '--button-primary',
  BUTTON_PRIMARY_HOVER: '--button-primary-hover',
  HEADER_BACKGROUND: '--header-background',
  CARD_ACCENT: '--card-accent',
  BORDER_ACCENT: '--border-accent',

  // Logo
  ADVISOR_LOGO_URL: '--advisor-logo-url',
  ADVISOR_BRAND_NAME: '--advisor-brand-name',
} as const;

/**
 * shadcn/Tailwind design tokens (see globals.css :root). The main UI reads these —
 * not --advisor-* — so we mirror advisor colors here when a branded experience is active.
 */
const SHADCN_THEME_BRIDGE_VARS = [
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--accent',
  '--accent-foreground',
  '--ring',
  '--sidebar-primary',
  '--sidebar-primary-foreground',
  '--brand',
  '--brand-foreground',
] as const;

function clearThemeVariablesFromRoot(root: HTMLElement): void {
  Object.values(THEME_VARIABLES).forEach((variable) => {
    root.style.removeProperty(variable);
  });
  SHADCN_THEME_BRIDGE_VARS.forEach((variable) => {
    root.style.removeProperty(variable);
  });
}

/**
 * Convert hex color to HSL values for CSS variables
 */
export function hexToHSL(hex: string): string {
  // Remove hash if present
  const cleanHex = hex.replace('#', '');

  // Parse RGB values
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

  // Convert to HSL values suitable for CSS (0-360 for hue, 0-100% for S and L)
  const hValue = Math.round(h * 360);
  const sValue = Math.round(s * 100);
  const lValue = Math.round(l * 100);

  return `${hValue} ${sValue}% ${lValue}%`;
}

/**
 * Lighten a color by adjusting the lightness value
 */
export function lightenColor(hex: string, amount: number): string {
  const hsl = hexToHSL(hex);
  const [h, s, l] = hsl.split(' ');
  const lightness = parseInt(l.replace('%', ''));
  const newLightness = Math.min(100, lightness + amount);

  return hslToHex(`${h} ${s} ${newLightness}%`);
}

/**
 * Darken a color by adjusting the lightness value
 */
export function darkenColor(hex: string, amount: number): string {
  const hsl = hexToHSL(hex);
  const [h, s, l] = hsl.split(' ');
  const lightness = parseInt(l.replace('%', ''));
  const newLightness = Math.max(0, lightness - amount);

  return hslToHex(`${h} ${s} ${newLightness}%`);
}

/**
 * Convert HSL back to hex
 */
function hslToHex(hsl: string): string {
  const [h, s, l] = hsl.split(' ').map((val, idx) => {
    if (idx === 0) return parseInt(val);
    return parseInt(val.replace('%', '')) / 100;
  });

  const hue = h as number;
  const saturation = s as number;
  const lightness = l as number;

  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - c / 2;

  let r = 0, g = 0, b = 0;

  if (0 <= hue && hue < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= hue && hue < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= hue && hue < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= hue && hue < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= hue && hue < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= hue && hue < 360) {
    r = c; g = 0; b = x;
  }

  const red = Math.round((r + m) * 255);
  const green = Math.round((g + m) * 255);
  const blue = Math.round((b + m) * 255);

  return `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`;
}

/**
 * Calculate contrast ratio between two colors
 */
export function calculateContrastRatio(color1: string, color2: string): number {
  const getLuminance = (color: string): number => {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;

    const [rs, gs, bs] = [r, g, b].map(c => {
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);

  const brighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (brighter + 0.05) / (darker + 0.05);
}

/**
 * Generate safe foreground color based on background
 */
export function getSafeTextColor(backgroundColor: string): string {
  const whiteContrast = calculateContrastRatio(backgroundColor, '#ffffff');
  const blackContrast = calculateContrastRatio(backgroundColor, '#000000');

  return whiteContrast > blackContrast ? '#ffffff' : '#000000';
}

/**
 * Apply advisor theme variables to document
 */
export function applyAdvisorTheme(branding: AdvisorBrandingData): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  clearThemeVariablesFromRoot(root);

  const resolvedHex = getPreviewBrandHex(branding);
  if (!resolvedHex) return;

  const primaryColor = resolvedHex.primary;
  const primaryHSL = hexToHSL(primaryColor);
  const primaryForeground = getSafeTextColor(primaryColor);

  root.style.setProperty(THEME_VARIABLES.ADVISOR_PRIMARY, primaryHSL);
  root.style.setProperty(
    THEME_VARIABLES.ADVISOR_PRIMARY_FOREGROUND,
    hexToHSL(primaryForeground)
  );
  root.style.setProperty(THEME_VARIABLES.BUTTON_PRIMARY, primaryColor);
  root.style.setProperty(
    THEME_VARIABLES.BUTTON_PRIMARY_HOVER,
    darkenColor(primaryColor, 10)
  );
  root.style.setProperty(THEME_VARIABLES.BORDER_ACCENT, primaryColor);

  const primaryCss = `hsl(${primaryHSL})`;
  const primaryFgCss = `hsl(${hexToHSL(primaryForeground)})`;
  root.style.setProperty('--primary', primaryCss);
  root.style.setProperty('--primary-foreground', primaryFgCss);
  root.style.setProperty('--ring', primaryCss);
  root.style.setProperty('--sidebar-primary', primaryCss);
  root.style.setProperty('--sidebar-primary-foreground', primaryFgCss);

  const secondaryColor = resolvedHex.secondary;
  const secondaryHSL = hexToHSL(secondaryColor);
  const secondaryForeground = getSafeTextColor(secondaryColor);

  root.style.setProperty(THEME_VARIABLES.ADVISOR_SECONDARY, secondaryHSL);
  root.style.setProperty(
    THEME_VARIABLES.ADVISOR_SECONDARY_FOREGROUND,
    hexToHSL(secondaryForeground)
  );
  root.style.setProperty(THEME_VARIABLES.HEADER_BACKGROUND, secondaryColor);
  root.style.setProperty('--secondary', `hsl(${secondaryHSL})`);
  root.style.setProperty(
    '--secondary-foreground',
    `hsl(${hexToHSL(secondaryForeground)})`
  );

  const accentColor = resolvedHex.accent;
  const accentHSL = hexToHSL(accentColor);
  const accentForeground = getSafeTextColor(accentColor);

  root.style.setProperty(THEME_VARIABLES.ADVISOR_ACCENT, accentHSL);
  root.style.setProperty(
    THEME_VARIABLES.ADVISOR_ACCENT_FOREGROUND,
    hexToHSL(accentForeground)
  );
  root.style.setProperty(THEME_VARIABLES.CARD_ACCENT, accentColor);
  root.style.setProperty('--accent', `hsl(${accentHSL})`);
  root.style.setProperty('--accent-foreground', `hsl(${hexToHSL(accentForeground)})`);
  root.style.setProperty('--brand', `hsl(${accentHSL})`);
  root.style.setProperty('--brand-foreground', `hsl(${hexToHSL(accentForeground)})`);

  // Apply logo URL
  if (branding.logoUrl) {
    root.style.setProperty(THEME_VARIABLES.ADVISOR_LOGO_URL, `url(${branding.logoUrl})`);
  }

  // Apply brand name (same resolution as client shell header)
  if (branding.advisorFirmName?.trim() || branding.brandName?.trim()) {
    root.style.setProperty(
      THEME_VARIABLES.ADVISOR_BRAND_NAME,
      `"${clientPortalBrandingDisplayTitle(branding)}"`,
    );
  }

  // Add advisor theme class
  root.setAttribute('data-advisor-theme', 'active');
}

/**
 * Remove advisor theme and restore defaults
 */
export function removeAdvisorTheme(): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  clearThemeVariablesFromRoot(root);

  // Remove advisor theme class
  root.removeAttribute('data-advisor-theme');
}

/**
 * Get current advisor theme values
 */
export function getCurrentTheme(): Record<string, string> {
  if (typeof document === 'undefined') return {};

  const root = document.documentElement;
  const theme: Record<string, string> = {};

  Object.entries(THEME_VARIABLES).forEach(([key, variable]) => {
    const value = getComputedStyle(root).getPropertyValue(variable);
    if (value) {
      theme[key] = value.trim();
    }
  });

  return theme;
}

/**
 * Create scoped theme styles for previews
 */
export function createScopedThemeStyles(branding: AdvisorBrandingData, scope: string): string {
  const styles: string[] = [];

  if (branding.primaryColor) {
    const primaryHSL = hexToHSL(branding.primaryColor);
    styles.push(`${scope} { ${THEME_VARIABLES.ADVISOR_PRIMARY}: ${primaryHSL}; }`);
    styles.push(`${scope} { ${THEME_VARIABLES.BUTTON_PRIMARY}: ${branding.primaryColor}; }`);
    styles.push(`${scope} { ${THEME_VARIABLES.BUTTON_PRIMARY_HOVER}: ${darkenColor(branding.primaryColor, 10)}; }`);
  }

  if (branding.secondaryColor) {
    const secondaryHSL = hexToHSL(branding.secondaryColor);
    styles.push(`${scope} { ${THEME_VARIABLES.ADVISOR_SECONDARY}: ${secondaryHSL}; }`);
    styles.push(`${scope} { ${THEME_VARIABLES.HEADER_BACKGROUND}: ${branding.secondaryColor}; }`);
  }

  if (branding.accentColor) {
    const accentHSL = hexToHSL(branding.accentColor);
    styles.push(`${scope} { ${THEME_VARIABLES.ADVISOR_ACCENT}: ${accentHSL}; }`);
  }

  if (branding.logoUrl) {
    styles.push(`${scope} { ${THEME_VARIABLES.ADVISOR_LOGO_URL}: url(${branding.logoUrl}); }`);
  }

  return styles.join('\n');
}

/**
 * Validate theme accessibility
 */
export function validateThemeAccessibility(branding: AdvisorBrandingData): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check primary color contrast
  if (branding.primaryColor) {
    const whiteContrast = calculateContrastRatio(branding.primaryColor, '#ffffff');
    const blackContrast = calculateContrastRatio(branding.primaryColor, '#000000');

    const bestContrast = Math.max(whiteContrast, blackContrast);

    if (bestContrast < 3) {
      errors.push('Primary color fails minimum contrast requirements (3:1)');
    } else if (bestContrast < 4.5) {
      warnings.push('Primary color barely meets WCAG AA contrast requirements (4.5:1)');
    }
  }

  // Check color differentiation
  if (branding.primaryColor && branding.secondaryColor) {
    const colorDifference = calculateContrastRatio(branding.primaryColor, branding.secondaryColor);
    if (colorDifference < 1.5) {
      warnings.push('Primary and secondary colors are too similar - may be confusing for users');
    }
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}