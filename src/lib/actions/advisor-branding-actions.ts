'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdvisorRole, getAdvisorProfileOrThrow } from '@/lib/advisor/auth';
import { prisma } from '@/lib/db';
import { brandingUpdateSchema } from '@/lib/validation/branding';
import { auditBrandingUpdate } from '@/lib/audit/branding-audit';
import { requireAdvisorBrandingAccess, checkRateLimit } from '@/lib/subscription/validation';
import {
  assertCanMutateAdvisorBranding,
  resolveAdvisorBrandingSettingsContext,
} from '@/lib/enterprise/branding-access';
import { generateLogoUploadUrl, confirmLogoUpload, deleteLogo, uploadLogoFromBuffer } from '@/lib/s3/branding-uploads';
import { isSubdomainReserved } from '@/lib/advisor/subdomain';
import {
  SUBDOMAIN_SLUG_MAX_LENGTH,
  SUBDOMAIN_SLUG_MIN_LENGTH,
  SUBDOMAIN_SLUG_REGEX,
  SUBDOMAIN_SLUG_VALIDATION_MESSAGE,
} from '@/lib/advisor/subdomain-slug-input';

const ENTERPRISE_BRANDING_MUTABLE_SELECT = {
  brandName: true,
  tagline: true,
  landingKicker: true,
  landingHeadline: true,
  landingSubheadline: true,
  landingSubtext: true,
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
} as const;

type BrandingMutableRow = {
  [K in keyof typeof ENTERPRISE_BRANDING_MUTABLE_SELECT]:
    | string
    | number
    | Date
    | null;
};

function collectBrandingFieldChanges(
  current: BrandingMutableRow,
  validatedData: z.infer<typeof brandingUpdateSchema>,
) {
  const updateData: Record<string, string | null> = {};
  const previousValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  Object.entries(validatedData).forEach(([key, value]) => {
    const dbValue = value === '' ? null : value;
    const currentValue = current[key as keyof BrandingMutableRow];
    if (currentValue !== dbValue) {
      updateData[key] = dbValue;
      previousValues[key] = currentValue;
      newValues[key] = dbValue;
    }
  });

  return { updateData, previousValues, newValues };
}

async function syncEnterpriseLogoFromAdvisorProfile(
  enterpriseId: string,
  advisorId: string,
): Promise<void> {
  const advisor = await prisma.advisorProfile.findUnique({
    where: { id: advisorId },
    select: {
      logoUrl: true,
      logoS3Key: true,
      logoContentType: true,
      logoFileSize: true,
      logoUploadedAt: true,
    },
  });
  if (!advisor) return;

  await prisma.advisorEnterprise.update({
    where: { id: enterpriseId },
    data: {
      logoUrl: advisor.logoUrl,
      logoS3Key: advisor.logoS3Key,
      logoContentType: advisor.logoContentType,
      logoFileSize: advisor.logoFileSize,
      logoUploadedAt: advisor.logoUploadedAt,
      updatedAt: new Date(),
    },
  });
}

async function clearEnterpriseLogo(enterpriseId: string): Promise<void> {
  await prisma.advisorEnterprise.update({
    where: { id: enterpriseId },
    data: {
      logoUrl: null,
      logoS3Key: null,
      logoContentType: null,
      logoFileSize: null,
      logoUploadedAt: null,
      updatedAt: new Date(),
    },
  });
}

export interface ActionResult {
  success: boolean;
  error?: string;
  data?: any;
}

/**
 * Enhanced advisor branding update action
 */
export async function updateAdvisorBrandingAction(formData: FormData): Promise<ActionResult> {
  try {
    const { userId } = await requireAdvisorRole();
    await assertCanMutateAdvisorBranding(userId);
    const { advisorId, features } = await requireAdvisorBrandingAccess(userId, 'write');

    // Parse and validate form data
    const rawData = {
      brandName: formData.get('brandName')?.toString() || '',
      tagline: formData.get('tagline')?.toString() || '',
      landingKicker: formData.get('landingKicker')?.toString() || '',
      landingHeadline: formData.get('landingHeadline')?.toString() || '',
      landingSubheadline: formData.get('landingSubheadline')?.toString() || '',
      landingSubtext: formData.get('landingSubtext')?.toString() || '',
      primaryColor: formData.get('primaryColor')?.toString() || '',
      secondaryColor: formData.get('secondaryColor')?.toString() || '',
      accentColor: formData.get('accentColor')?.toString() || '',
      websiteUrl: formData.get('websiteUrl')?.toString() || '',
      emailFooterText: formData.get('emailFooterText')?.toString() || '',
      supportEmail: formData.get('supportEmail')?.toString() || '',
      supportPhone: formData.get('supportPhone')?.toString() || '',
      logoUrl: formData.get('logoUrl')?.toString() || '', // Legacy support
    };

    // Schema expects string | "" — not null (null breaks z.union / .or(z.literal('')))
    const validatedData = brandingUpdateSchema.parse(rawData);

    // Feature-gate advanced fields
    if (!features.advancedBrandingEnabled) {
      // Only allow basic fields for STARTER tier
      const allowedFields = [
        'brandName',
        'logoUrl',
        'landingKicker',
        'landingHeadline',
        'landingSubheadline',
        'landingSubtext',
      ];
      const restrictedFields = Object.keys(validatedData).filter((field) => {
        if (allowedFields.includes(field)) return false;
        const v = validatedData[field as keyof typeof validatedData];
        return v !== null && v !== undefined && String(v).trim() !== '';
      });

      if (restrictedFields.length > 0) {
        return {
          success: false,
          error: `Advanced branding features (${restrictedFields.join(', ')}) are not available on your current plan. Please upgrade to access these features.`,
        };
      }
    }

    // Get current branding row for audit logging
    const settingsContext = await resolveAdvisorBrandingSettingsContext(userId);
    const isEnterpriseManage = settingsContext.mode === 'enterprise-manage';

    const currentBranding = isEnterpriseManage
      ? await prisma.advisorEnterprise.findUnique({
          where: { id: settingsContext.enterpriseId },
          select: ENTERPRISE_BRANDING_MUTABLE_SELECT,
        })
      : await prisma.advisorProfile.findUnique({
          where: { id: advisorId },
          select: {
            brandName: true,
            firmName: true,
            tagline: true,
            landingKicker: true,
            landingHeadline: true,
            landingSubheadline: true,
            landingSubtext: true,
            primaryColor: true,
            secondaryColor: true,
            accentColor: true,
            websiteUrl: true,
            emailFooterText: true,
            supportEmail: true,
            supportPhone: true,
            logoUrl: true,
          },
        });

    if (!currentBranding) {
      throw new Error(isEnterpriseManage ? 'Enterprise not found' : 'Advisor profile not found');
    }

    const { updateData, previousValues, newValues } = collectBrandingFieldChanges(
      currentBranding as BrandingMutableRow,
      validatedData,
    );

    if (!isEnterpriseManage && settingsContext.mode === 'solo' && updateData.brandName !== undefined) {
      const currentAdvisor = currentBranding as {
        firmName: string | null;
      };
      const syncedFirmName = updateData.brandName;
      if (currentAdvisor.firmName !== syncedFirmName) {
        updateData.firmName = syncedFirmName;
        previousValues.firmName = currentAdvisor.firmName;
        newValues.firmName = syncedFirmName;
      }
    }

    // Only proceed if there are changes
    if (Object.keys(updateData).length === 0) {
      return {
        success: true,
        data: currentBranding,
      };
    }

    const updatedBranding = isEnterpriseManage
      ? await prisma.advisorEnterprise.update({
          where: { id: settingsContext.enterpriseId },
          data: {
            ...updateData,
            updatedAt: new Date(),
          },
          select: ENTERPRISE_BRANDING_MUTABLE_SELECT,
        })
      : await prisma.advisorProfile.update({
          where: { id: advisorId },
          data: {
            ...updateData,
            updatedAt: new Date(),
          },
          select: {
            brandName: true,
            tagline: true,
            landingKicker: true,
            landingHeadline: true,
            landingSubheadline: true,
            landingSubtext: true,
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
          },
        });

    // Audit the change
    await auditBrandingUpdate(advisorId, userId, previousValues, newValues);

    // Revalidate affected pages
    revalidatePath('/advisor/settings');
    revalidatePath('/advisor');

    return {
      success: true,
      data: updatedBranding,
    };
  } catch (error) {
    console.error('Error updating advisor branding:', error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Invalid input data',
        data: error.flatten().fieldErrors,
      };
    }

    const message = error instanceof Error ? error.message : 'Failed to update branding';
    return { success: false, error: message };
  }
}

/**
 * Get advisor branding data
 */
export async function getAdvisorBrandingAction(): Promise<ActionResult> {
  try {
    const { userId } = await requireAdvisorRole();
    const { advisorId, features } = await requireAdvisorBrandingAccess(userId, 'read');

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
      },
    });

    if (!advisor) {
      throw new Error('Advisor profile not found');
    }

    return {
      success: true,
      data: {
        branding: advisor,
        features,
      },
    };
  } catch (error) {
    console.error('Error fetching advisor branding:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch branding data';
    return { success: false, error: message };
  }
}

/**
 * Generate upload URL for logo
 */
export async function generateLogoUploadUrlAction(
  fileName: string,
  fileType: string,
  fileSize: number
): Promise<ActionResult> {
  try {
    const { userId } = await requireAdvisorRole();
    await assertCanMutateAdvisorBranding(userId);
    const { advisorId } = await requireAdvisorBrandingAccess(userId, 'write');

    // Validate file parameters
    if (!fileName || !fileType || !fileSize) {
      return {
        success: false,
        error: 'File name, type, and size are required',
      };
    }

    const uploadResponse = await generateLogoUploadUrl({
      advisorId,
      fileName,
      fileType,
      fileSize,
    });

    return {
      success: true,
      data: uploadResponse,
    };
  } catch (error) {
    console.error('Error generating upload URL:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate upload URL';
    return { success: false, error: message };
  }
}

/**
 * Confirm logo upload
 */
/**
 * Server-side logo upload (same-origin); avoids configuring S3 CORS for browser PUT.
 */
export async function uploadLogoDirectAction(
  fileName: string,
  fileType: string,
  buffer: Uint8Array
): Promise<ActionResult> {
  try {
    const { userId } = await requireAdvisorRole();
    await assertCanMutateAdvisorBranding(userId);
    const { advisorId } = await requireAdvisorBrandingAccess(userId, 'write');

    if (!fileName || !buffer.byteLength) {
      return {
        success: false,
        error: 'File name and file data are required',
      };
    }

    const rateLimit = await checkRateLimit(advisorId, 'logo_upload', 1);
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: 'Rate limit exceeded. Please try again later.',
      };
    }

    const effectiveType = fileType?.trim() ? fileType : 'application/octet-stream';
    const data = await uploadLogoFromBuffer(advisorId, fileName, effectiveType, buffer);

    const settingsContext = await resolveAdvisorBrandingSettingsContext(userId);
    if (settingsContext.mode === 'enterprise-manage') {
      await syncEnterpriseLogoFromAdvisorProfile(settingsContext.enterpriseId, advisorId);
    }

    revalidatePath('/advisor/settings');
    revalidatePath('/advisor');

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Error uploading logo (direct):', error);
    const message = error instanceof Error ? error.message : 'Failed to upload logo';
    return { success: false, error: message };
  }
}

export async function confirmLogoUploadAction(
  uploadId: string,
  s3Key: string,
  originalFileName: string
): Promise<ActionResult> {
  try {
    const { userId } = await requireAdvisorRole();
    await assertCanMutateAdvisorBranding(userId);
    await requireAdvisorBrandingAccess(userId, 'write');

    const confirmResponse = await confirmLogoUpload({
      uploadId,
      s3Key,
      originalFileName,
    });

    // Revalidate pages to show new logo
    revalidatePath('/advisor/settings');
    revalidatePath('/advisor');

    return {
      success: true,
      data: confirmResponse,
    };
  } catch (error) {
    console.error('Error confirming upload:', error);
    const message = error instanceof Error ? error.message : 'Failed to confirm upload';
    return { success: false, error: message };
  }
}

/**
 * Delete advisor logo
 */
export async function deleteLogoAction(): Promise<ActionResult> {
  try {
    const { userId } = await requireAdvisorRole();
    await assertCanMutateAdvisorBranding(userId);
    const { advisorId } = await requireAdvisorBrandingAccess(userId, 'delete');

    await deleteLogo(advisorId);

    const settingsContext = await resolveAdvisorBrandingSettingsContext(userId);
    if (settingsContext.mode === 'enterprise-manage') {
      await clearEnterpriseLogo(settingsContext.enterpriseId);
    }

    // Revalidate pages to reflect logo deletion
    revalidatePath('/advisor/settings');
    revalidatePath('/advisor');

    return {
      success: true,
    };
  } catch (error) {
    console.error('Error deleting logo:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete logo';
    return { success: false, error: message };
  }
}

/**
 * Check subdomain availability
 */
export async function checkSubdomainAvailabilityAction(subdomain: string): Promise<ActionResult> {
  try {
    const { userId } = await requireAdvisorRole();
    await requireAdvisorBrandingAccess(userId, 'read');

    // Validate subdomain format
    const subdomainRegex = SUBDOMAIN_SLUG_REGEX;
    if (!subdomainRegex.test(subdomain) || subdomain.length < SUBDOMAIN_SLUG_MIN_LENGTH || subdomain.length > SUBDOMAIN_SLUG_MAX_LENGTH) {
      return {
        success: false,
        error: SUBDOMAIN_SLUG_VALIDATION_MESSAGE,
      };
    }

    const reservedCheck = await isSubdomainReserved(subdomain.toLowerCase());
    if (reservedCheck.reserved) {
      return {
        success: true,
        data: {
          available: false,
          reason: `Subdomain '${subdomain}' is reserved: ${reservedCheck.reason}`,
          suggestions: generateSubdomainSuggestions(subdomain),
        },
      };
    }

    // Check if subdomain is already taken
    const existing = await prisma.advisorSubdomain.findUnique({
      where: { subdomain },
    });

    if (existing) {
      return {
        success: true,
        data: {
          available: false,
          reason: `Subdomain '${subdomain}' is already taken`,
          suggestions: generateSubdomainSuggestions(subdomain),
        },
      };
    }

    return {
      success: true,
      data: {
        available: true,
      },
    };
  } catch (error) {
    console.error('Error checking subdomain availability:', error);
    const message = error instanceof Error ? error.message : 'Failed to check subdomain availability';
    return { success: false, error: message };
  }
}

/**
 * Generate subdomain suggestions
 */
function generateSubdomainSuggestions(baseSubdomain: string): string[] {
  const suggestions: string[] = [];
  const suffixes = ['hq', 'group', 'capital', 'advisors', '2024', 'pro'];
  const prefixes = ['my', 'the', 'team'];

  // Add number suffixes
  for (let i = 1; i <= 3; i++) {
    suggestions.push(`${baseSubdomain}${i}`);
  }

  // Add word suffixes
  suffixes.forEach(suffix => {
    if ((baseSubdomain + suffix).length <= 20) {
      suggestions.push(`${baseSubdomain}${suffix}`);
    }
  });

  // Add word prefixes
  prefixes.forEach(prefix => {
    if ((prefix + baseSubdomain).length <= 20) {
      suggestions.push(`${prefix}${baseSubdomain}`);
    }
  });

  return suggestions.slice(0, 5); // Return top 5 suggestions
}

// Legacy action for backward compatibility
export async function updateAdvisorBranding(formData: FormData) {
  return updateAdvisorBrandingAction(formData);
}