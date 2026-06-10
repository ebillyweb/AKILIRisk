import { z } from 'zod';

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const SUBDOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/** US-59 / BRD: advisor logo uploads up to 5 MB (all paid tiers). */
export const LOGO_MAX_BYTES = 5 * 1024 * 1024;

function isHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validates if a color has sufficient contrast for accessibility
 */
function validateColorAccessibility(color: string): boolean {
  // Simple luminance calculation for contrast validation
  const hex = color.slice(1);
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Check contrast with white and black
  const contrastWithWhite = (1.05) / (luminance + 0.05);
  const contrastWithBlack = (luminance + 0.05) / (0.05);

  // Ensure at least one contrast ratio meets WCAG AA (4.5:1)
  return Math.max(contrastWithWhite, contrastWithBlack) >= 4.5;
}

/**
 * Schema for advisor branding updates
 */
export const brandingUpdateSchema = z.object({
  brandName: z.string()
    .min(1, 'Brand name is required')
    .max(100, 'Brand name must be less than 100 characters')
    .regex(/^[a-zA-Z0-9\s\-&.,']+$/, 'Invalid characters in brand name')
    .optional()
    .or(z.literal('')),

  tagline: z.string()
    .max(150, 'Tagline must be less than 150 characters')
    .optional()
    .or(z.literal('')),

  primaryColor: z.string()
    .regex(HEX_COLOR_REGEX, 'Primary color must be valid hex format (#RRGGBB)')
    .refine(validateColorAccessibility, 'Primary color fails accessibility requirements')
    .optional()
    .or(z.literal('')),

  secondaryColor: z.string()
    .regex(HEX_COLOR_REGEX, 'Secondary color must be valid hex format (#RRGGBB)')
    .optional()
    .or(z.literal('')),

  accentColor: z.string()
    .regex(HEX_COLOR_REGEX, 'Accent color must be valid hex format (#RRGGBB)')
    .optional()
    .or(z.literal('')),

  websiteUrl: z
    .union([
      z.literal(''),
      z
        .string()
        .min(1, 'Invalid website URL')
        .url('Invalid website URL')
        .refine((url) => isHttpsUrl(url), 'Website URL must use HTTPS'),
    ])
    .optional(),

  emailFooterText: z.string()
    .max(300, 'Email footer text must be less than 300 characters')
    .optional()
    .or(z.literal('')),

  supportEmail: z.string()
    .email('Invalid support email address')
    .optional()
    .or(z.literal('')),

  supportPhone: z.string()
    .max(20, 'Support phone must be less than 20 characters')
    .regex(/^[\+]?[0-9\s\-\(\)\.]+$/, 'Invalid phone number format')
    .optional()
    .or(z.literal('')),

  // Legacy field for backward compatibility
  logoUrl: z
    .union([
      z.literal(''),
      z
        .string()
        .min(1, 'Invalid logo URL')
        .url('Invalid logo URL')
        .refine((url) => isHttpsUrl(url), 'Logo URL must use HTTPS'),
    ])
    .optional(),
});

/**
 * Schema for subdomain validation
 */
export const subdomainSchema = z.object({
  subdomain: z.string()
    .min(3, 'Subdomain must be at least 3 characters')
    .max(20, 'Subdomain must be less than 20 characters')
    .regex(SUBDOMAIN_REGEX, 'Subdomain can only contain lowercase letters, numbers, and hyphens')
    .refine(subdomain => !subdomain.startsWith('-') && !subdomain.endsWith('-'), 'Subdomain cannot start or end with hyphens'),
});

/**
 * Schema for file upload validation
 */
export const logoUploadSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  fileType: z.enum(['image/png', 'image/jpeg', 'image/svg+xml'], {
    message: 'File type must be PNG, JPEG, or SVG',
  }),
  fileSize: z.number()
    .min(1, 'File cannot be empty')
    .max(LOGO_MAX_BYTES, `File size must be less than ${LOGO_MAX_BYTES / (1024 * 1024)}MB`),
});

/**
 * Type definitions for branding data
 */
export type BrandingFormData = z.infer<typeof brandingUpdateSchema>;
export type SubdomainFormData = z.infer<typeof subdomainSchema>;
export type LogoUploadData = z.infer<typeof logoUploadSchema>;

/**
 * Interface for complete advisor branding data
 */
export interface AdvisorBrandingData {
  // Basic identity
  brandName?: string | null;
  /** Legacy firm name from advisor profile (e.g. PDF/report fallbacks) */
  advisorFirmName?: string | null;
  tagline?: string | null;
  websiteUrl?: string | null;

  // Colors
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;

  // Contact information
  emailFooterText?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;

  // Logo assets
  logoUrl?: string | null;
  logoS3Key?: string | null;
  logoContentType?: string | null;
  logoFileSize?: number | null;
  logoUploadedAt?: Date | null;

  // Feature flags
  brandingEnabled: boolean;
  customDomainEnabled: boolean;

  // Subdomain
  subdomain?: {
    subdomain: string;
    isActive: boolean;
    dnsVerified: boolean;
    sslProvisioned: boolean;
  } | null;
}

/**
 * Interface for subscription feature access
 */
export interface SubscriptionFeatures {
  tier: 'STARTER' | 'GROWTH' | 'PROFESSIONAL' | 'ENTERPRISE';
  basicBrandingEnabled: boolean;
  advancedBrandingEnabled: boolean;
  customSubdomainEnabled: boolean;
  whiteLabel: boolean;
}

/**
 * Color utility functions
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
 * Color harmony suggestions
 */
export function generateColorHarmony(baseColor: string): {
  complementary: string;
  analogous: string[];
  triadic: string[];
} {
  const hex = baseColor.slice(1);
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  // Convert RGB to HSL
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const diff = max - min;

  let h = 0;
  const l = (max + min) / 2;
  const s = diff === 0 ? 0 : diff / (1 - Math.abs(2 * l - 1));

  if (diff !== 0) {
    switch (max) {
      case r / 255: h = ((g - b) / 255 / diff + (g < b ? 6 : 0)) / 6; break;
      case g / 255: h = ((b - r) / 255 / diff + 2) / 6; break;
      case b / 255: h = ((r - g) / 255 / diff + 4) / 6; break;
    }
  }

  // Generate harmonious colors
  const hslToHex = (h: number, s: number, l: number): string => {
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h * 12) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  return {
    complementary: hslToHex((h + 0.5) % 1, s, l),
    analogous: [
      hslToHex((h + 0.083) % 1, s, l), // +30 degrees
      hslToHex((h - 0.083 + 1) % 1, s, l), // -30 degrees
    ],
    triadic: [
      hslToHex((h + 0.333) % 1, s, l), // +120 degrees
      hslToHex((h + 0.667) % 1, s, l), // +240 degrees
    ],
  };
}