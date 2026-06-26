import { clientPortalBrandingDisplayTitle } from '@/lib/client/client-portal-branding';
import { prisma } from '@/lib/db';
import { AdvisorBrandingData } from '@/lib/validation/branding';
import {
  ESSENTIALS_SUBSCRIPTION_FEATURES,
  subscriptionFeaturesFromRow,
} from '@/lib/subscription/validation';

/**
 * Fetch complete advisor branding data for PDF generation
 */
export async function getAdvisorBrandingForPDF(advisorId: string): Promise<AdvisorBrandingData | null> {
  try {
    const advisor = await prisma.advisorProfile.findUnique({
      where: { id: advisorId },
      select: {
        brandName: true,
        tagline: true,
        primaryColor: true,
        secondaryColor: true,
        accentColor: true,
        websiteUrl: true,
        emailFooterText: true,
        supportEmail: true,
        supportPhone: true,
        logoUrl: true,
        logoS3Key: true,
        logoContentType: true,
        logoFileSize: true,
        logoUploadedAt: true,
        brandingEnabled: true,
        customDomainEnabled: true,
        // Include firm name for backward compatibility
        firmName: true,
        user: {
          select: {
            subscription: {
              select: {
                tier: true,
              },
            },
          },
        },
      },
    });

    if (!advisor || !advisor.brandingEnabled) {
      return null;
    }

    const subscription = advisor.user.subscription;
    const subFeatures = subscription
      ? subscriptionFeaturesFromRow(subscription)
      : ESSENTIALS_SUBSCRIPTION_FEATURES;

    if (!subFeatures.basicBrandingEnabled) {
      return null;
    }

    // Build complete branding data
    const branding: AdvisorBrandingData = {
      brandName: advisor.brandName,
      tagline: advisor.tagline,
      primaryColor: subFeatures.advancedBrandingEnabled ? advisor.primaryColor : null,
      secondaryColor: subFeatures.advancedBrandingEnabled ? advisor.secondaryColor : null,
      accentColor: subFeatures.advancedBrandingEnabled ? advisor.accentColor : null,
      websiteUrl: advisor.websiteUrl,
      emailFooterText: advisor.emailFooterText,
      supportEmail: advisor.supportEmail,
      supportPhone: advisor.supportPhone,
      logoUrl: advisor.logoUrl,
      logoS3Key: advisor.logoS3Key,
      logoContentType: advisor.logoContentType,
      logoFileSize: advisor.logoFileSize,
      logoUploadedAt: advisor.logoUploadedAt,
      brandingEnabled: advisor.brandingEnabled,
      customDomainEnabled: advisor.customDomainEnabled,

      // Legacy compatibility
      advisorFirmName: advisor.firmName,
    };

    return branding;
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