'use client';

import { AdvisorBrandingData } from '@/lib/validation/branding';
import {
  THEME_VARIABLES,
  buildAdvisorRootThemeProperties,
  calculateContrastRatio,
  darkenColor,
  hexToHSL,
} from '@/lib/theming/advisor-root-theme';

export {
  THEME_VARIABLES,
  calculateContrastRatio,
  darkenColor,
  getSafeTextColor,
  hexToHSL,
} from '@/lib/theming/advisor-root-theme';

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
 * Lighten a color by adjusting the lightness value
 */
export function lightenColor(hex: string, amount: number): string {
  const hsl = hexToHSL(hex);
  const [h, s, l] = hsl.split(' ');
  const lightness = parseInt(l.replace('%', ''), 10);
  const newLightness = Math.min(100, lightness + amount);

  const hslToHex = (hslValue: string): string => {
    const [hue, sat, light] = hslValue.split(' ').map((val, idx) => {
      if (idx === 0) return parseInt(val, 10);
      return parseInt(val.replace('%', ''), 10) / 100;
    });
    const hNum = hue as number;
    const sNum = sat as number;
    const lNum = light as number;
    const c = (1 - Math.abs(2 * lNum - 1)) * sNum;
    const x = c * (1 - Math.abs(((hNum / 60) % 2) - 1));
    const m = lNum - c / 2;
    let r = 0;
    let g = 0;
    let b = 0;
    if (hNum >= 0 && hNum < 60) {
      r = c;
      g = x;
    } else if (hNum >= 60 && hNum < 120) {
      r = x;
      g = c;
    } else if (hNum >= 120 && hNum < 180) {
      g = c;
      b = x;
    } else if (hNum >= 180 && hNum < 240) {
      g = x;
      b = c;
    } else if (hNum >= 240 && hNum < 300) {
      r = x;
      b = c;
    } else if (hNum >= 300 && hNum < 360) {
      r = c;
      b = x;
    }
    const red = Math.round((r + m) * 255);
    const green = Math.round((g + m) * 255);
    const blue = Math.round((b + m) * 255);
    return `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`;
  };

  return hslToHex(`${h} ${s} ${newLightness}%`);
}

/**
 * Apply advisor theme variables to document
 */
export function applyAdvisorTheme(branding: AdvisorBrandingData): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  clearThemeVariablesFromRoot(root);

  const props = buildAdvisorRootThemeProperties(branding);
  if (!props) return;

  Object.entries(props).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  root.setAttribute('data-advisor-theme', 'active');
}

/**
 * Remove advisor theme and restore defaults
 */
export function removeAdvisorTheme(): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  clearThemeVariablesFromRoot(root);
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

  if (branding.primaryColor && branding.secondaryColor) {
    const colorDifference = calculateContrastRatio(
      branding.primaryColor,
      branding.secondaryColor
    );
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
