import { clientPortalBrandingDisplayTitle } from '@/lib/client/client-portal-branding';
import { resolveAdvisorBrandingForProfile } from '@/lib/enterprise/branding';
import { AdvisorBrandingData } from '@/lib/validation/branding';

/**
 * Fetch advisor branding for PDF generation (assigned-client scope).
 */
export async function getAdvisorBrandingForPDF(advisorId: string): Promise<AdvisorBrandingData | null> {
  try {
    return await resolveAdvisorBrandingForProfile(advisorId, { scope: 'client' });
  } catch (error) {
    console.error('Error fetching advisor branding for PDF:', error);
    return null;
  }
}

/**
 * Get advisor branding from user ID (for convenience)
 */
export async function getAdvisorBrandingForPDFByUserId(userId: string): Promise<AdvisorBrandingData | null> {
  try {
    const { prisma } = await import('@/lib/db');
    const advisor = await prisma.advisorProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!advisor) {
      return null;
    }

    return getAdvisorBrandingForPDF(advisor.id);
  } catch (error) {
    console.error('Error fetching advisor branding by user ID:', error);
    return null;
  }
}

/**
 * Create branded PDF metadata
 */
export function pdfDisplayNameFromBranding(branding?: AdvisorBrandingData | null): string {
  if (!branding) return "Akili Risk";
  const t = clientPortalBrandingDisplayTitle(branding);
  return t === "Partner portal" ? "Akili Risk" : t;
}

export function createBrandedPDFMetadata(branding?: AdvisorBrandingData) {
  const brandName = pdfDisplayNameFromBranding(branding);

  return {
    title: 'Family Risk Assessment Report',
    author: brandName,
    creator: brandName,
    producer: 'AkiliRisk Platform',
    subject: 'Confidential Family Risk Assessment and Governance Analysis',
    keywords: 'risk assessment, family governance, security analysis, confidential',
    creationDate: new Date(),
  };
}

/**
 * Generate branded document title
 */
export function generateBrandedDocumentTitle(
  documentType: string,
  clientName?: string,
  branding?: AdvisorBrandingData
): string {
  const brandName = pdfDisplayNameFromBranding(branding);
  const clientPart = clientName ? ` - ${clientName}` : '';

  return `${documentType} by ${brandName}${clientPart}`;
}

/**
 * Helper to determine if enhanced branding features are available
 */
export function hasAdvancedBrandingFeatures(branding?: AdvisorBrandingData): boolean {
  return !!(
    branding &&
    (branding.primaryColor || branding.secondaryColor || branding.accentColor)
  );
}

/**
 * Get fallback branding for legacy support
 */
export function getLegacyBrandingFallback(firmName?: string, logoUrl?: string): AdvisorBrandingData {
  return {
    brandName: firmName || 'Akili Risk',
    logoUrl: logoUrl,
    advisorFirmName: firmName,
    brandingEnabled: true,
    customDomainEnabled: false,
  };
}

/**
 * Validate branding data for PDF usage
 */
export function validateBrandingForPDF(branding: AdvisorBrandingData): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check logo URL accessibility
  if (branding.logoUrl) {
    try {
      new URL(branding.logoUrl);
      if (!branding.logoUrl.startsWith('https://')) {
        warnings.push('Logo URL should use HTTPS for better security');
      }
    } catch {
      errors.push('Invalid logo URL format');
    }
  }

  // Check color format
  const colorFields = ['primaryColor', 'secondaryColor', 'accentColor'] as const;
  colorFields.forEach(field => {
    const color = branding[field];
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      errors.push(`Invalid ${field} format - must be hex color (e.g., #1a1a2e)`);
    }
  });

  // Check text lengths for PDF compatibility
  if (branding.brandName && branding.brandName.length > 50) {
    warnings.push('Brand name is quite long and may be truncated in PDFs');
  }

  if (branding.tagline && branding.tagline.length > 100) {
    warnings.push('Tagline is long and may be truncated in PDFs');
  }

  if (branding.emailFooterText && branding.emailFooterText.length > 200) {
    warnings.push('Email footer text is long and may be truncated in PDFs');
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Format branding data for logging (remove sensitive info)
 */
export function formatBrandingForLogging(branding: AdvisorBrandingData) {
  return {
    hasBrandName: !!branding.brandName,
    hasTagline: !!branding.tagline,
    hasColors: !!(branding.primaryColor || branding.secondaryColor || branding.accentColor),
    hasLogo: !!branding.logoUrl,
    hasContactInfo: !!(branding.supportEmail || branding.supportPhone),
    brandingEnabled: branding.brandingEnabled,
    customDomainEnabled: branding.customDomainEnabled,
  };
}
