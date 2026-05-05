import * as fs from 'fs';
import * as path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { TemplateId, TemplateData, TEMPLATE_REGISTRY, TemplateMetadata } from './types';
import { AdvisorBrandingData } from '@/lib/validation/branding';
import { getAdvisorBrandingForPDF } from '@/lib/pdf/branding-integration';

/**
 * Enhanced template data that includes advisor branding
 */
export interface EnhancedTemplateData extends TemplateData {
  // Advisor branding variables
  advisorBrandName?: string;
  advisorTagline?: string;
  advisorWebsite?: string;
  advisorSupportEmail?: string;
  advisorSupportPhone?: string;
  advisorFooterText?: string;
  advisorFirmName?: string; // Legacy compatibility

  // Document metadata
  generatedDate?: string;
  documentType?: string;
  confidentialityStatement?: string;
}

/**
 * Convert advisor branding data to template variables
 */
export function brandingToTemplateData(branding?: AdvisorBrandingData): Partial<EnhancedTemplateData> {
  if (!branding) {
    return {
      advisorBrandName: 'Akili Risk',
      advisorFirmName: 'Akili Risk',
    };
  }

  const brandDisplayName = branding.brandName || branding.advisorFirmName || 'Akili Risk';

  return {
    advisorBrandName: brandDisplayName,
    advisorTagline: branding.tagline || '',
    advisorWebsite: branding.websiteUrl || '',
    advisorSupportEmail: branding.supportEmail || '',
    advisorSupportPhone: branding.supportPhone || '',
    advisorFooterText: branding.emailFooterText || '',
    advisorFirmName: brandDisplayName, // For legacy templates
  };
}

/**
 * Generate enhanced Word document with advisor branding
 */
export function generateBrandedTemplate(
  templateId: TemplateId,
  data: TemplateData,
  branding?: AdvisorBrandingData
): Buffer {
  // Combine base data with branding data
  const brandingData = brandingToTemplateData(branding);
  const enhancedData: EnhancedTemplateData = {
    ...data,
    ...brandingData,
    generatedDate: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    documentType: TEMPLATE_REGISTRY.find(t => t.id === templateId)?.name || 'Policy Document',
    confidentialityStatement: `CONFIDENTIAL: This document contains sensitive family governance information and is intended solely for the ${data.familyName} family. Distribution without written consent from ${brandingData.advisorBrandName} is prohibited.`,
  };

  return generateEnhancedTemplate(templateId, enhancedData);
}

/**
 * Generate Word document from enhanced template data
 */
export function generateEnhancedTemplate(templateId: TemplateId, data: EnhancedTemplateData): Buffer {
  // First try to load enhanced template, fall back to standard template
  const enhancedTemplatePath = path.join(process.cwd(), 'templates', `${templateId}-enhanced.docx`);
  const standardTemplatePath = path.join(process.cwd(), 'templates', `${templateId}.docx`);

  let templatePath: string;
  if (fs.existsSync(enhancedTemplatePath)) {
    templatePath = enhancedTemplatePath;
  } else if (fs.existsSync(standardTemplatePath)) {
    templatePath = standardTemplatePath;
  } else {
    throw new Error(`Template file not found: ${templateId}`);
  }

  // Read template file
  const content = fs.readFileSync(templatePath, 'binary');

  // Create zip instance and document templater
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter(part: any) {
      // Enhanced null handling for branding fields
      const value = part.value?.toString().toLowerCase();

      // Return empty string for missing advisor branding fields
      if (value?.startsWith('advisor') || value?.startsWith('brand')) {
        return '';
      }

      // Return empty string for missing household placeholders
      if (part.module === 'loop' ||
          value?.startsWith('household') ||
          value?.startsWith('decisionmaker') ||
          value?.startsWith('successor') ||
          value?.startsWith('trustee') ||
          value?.startsWith('beneficiar') ||
          value?.startsWith('executor') ||
          value?.startsWith('householdhead')) {
        return '';
      }

      // For other missing placeholders, preserve existing behavior
      return `{${part.value}}`;
    }
  });

  // Render template with enhanced data
  doc.render(data);

  // Generate buffer
  const buffer = doc.getZip().generate({ type: 'nodebuffer' });

  return buffer;
}

/**
 * Create enhanced template with advisor branding by advisor ID
 */
export async function generateBrandedTemplateByAdvisorId(
  templateId: TemplateId,
  data: TemplateData,
  advisorId: string
): Promise<Buffer> {
  const branding = await getAdvisorBrandingForPDF(advisorId);
  return generateBrandedTemplate(templateId, data, branding ?? undefined);
}

/**
 * Get template metadata with branding requirement info
 */
export function getEnhancedTemplateMetadata(): (TemplateMetadata & { supportsBranding: boolean })[] {
  return TEMPLATE_REGISTRY.map(template => ({
    ...template,
    supportsBranding: true, // All templates support branding
  }));
}

/**
 * Validate template data for branding consistency
 */
export function validateEnhancedTemplateData(data: EnhancedTemplateData): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check required fields
  if (!data.familyName) {
    errors.push('Family name is required');
  }

  if (!data.assessmentDate) {
    errors.push('Assessment date is required');
  }

  // Validate advisor branding fields
  if (data.advisorSupportEmail && !isValidEmail(data.advisorSupportEmail)) {
    errors.push('Invalid advisor support email format');
  }

  if (data.advisorWebsite && !isValidUrl(data.advisorWebsite)) {
    warnings.push('Advisor website URL may be invalid');
  }

  // Check for missing branding that could improve document quality
  if (!data.advisorBrandName) {
    warnings.push('No advisor brand name provided - using default');
  }

  if (!data.advisorTagline) {
    warnings.push('No advisor tagline provided');
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Helper functions for validation
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get document filename with branding
 */
export function getBrandedDocumentFilename(
  templateId: TemplateId,
  familyName: string,
  branding?: AdvisorBrandingData
): string {
  const template = TEMPLATE_REGISTRY.find(t => t.id === templateId);
  const templateName = template?.name || 'Policy Document';
  const brandName = branding?.brandName || branding?.advisorFirmName || 'Akili Risk';

  const familySlug = familyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const brandSlug = brandName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const templateSlug = templateId;

  return `${brandSlug}-${familySlug}-${templateSlug}.docx`;
}

// Legacy compatibility exports
export { generateTemplate } from './generator';
export { getAvailableTemplates } from './generator';