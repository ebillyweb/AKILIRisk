import type { PrismaClient } from "@prisma/client";

/** AdvisorEnterprise columns copied from preview → production (not billing or identity). */
export const ENTERPRISE_SETTINGS_FIELD_NAMES = [
  "brandName",
  "tagline",
  "landingKicker",
  "landingHeadline",
  "landingSubheadline",
  "landingSubtext",
  "primaryColor",
  "secondaryColor",
  "accentColor",
  "websiteUrl",
  "emailFooterText",
  "supportEmail",
  "supportPhone",
  "logoUrl",
  "logoS3Key",
  "logoContentType",
  "logoFileSize",
  "logoUploadedAt",
  "brandingEnabled",
  "implementationTrackingEnabled",
  "advisorMemberPortfolioVisible",
  "advisorMemberAssessmentLeadsVisible",
  "advisorMemberMethodologyVisible",
  "advisorMemberEngagementsVisible",
  "advisorMemberReassessmentVisible",
  "advisorMemberProductToursVisible",
  "advisorMemberHideTierLockedNav",
  "advisorMemberSkipIntakeEnabled",
  "advisorMemberSkipPostIntakeReviewEnabled",
  "advisorMemberDocumentRequirementsEnabled",
  "advisorMemberActionPlanEnabled",
  "advisorMemberPersonalBrandingEnabled",
  "advisorMemberSubdomainEditable",
  "advisorMemberPseudonymousLabelingDefault",
  "advisorMemberCollectClientLegalNameDefault",
  "advisorMemberClientDataPolicyLocked",
  "intakeQuestionBankMode",
  "assessmentQuestionBankMode",
  "clientReminderEmailsEnabled",
  "advisorReminderEmailsEnabled",
  "defaultCadenceFrequency",
  "customDomainEnabled",
] as const;

export type EnterpriseSettingsFieldName = (typeof ENTERPRISE_SETTINGS_FIELD_NAMES)[number];

export function buildEnterpriseSettingsSelect(
  fields: Iterable<EnterpriseSettingsFieldName>,
): Record<EnterpriseSettingsFieldName, true> {
  const select = {} as Record<EnterpriseSettingsFieldName, true>;
  for (const field of fields) {
    select[field] = true;
  }
  return select;
}

/** Probe which AdvisorEnterprise settings columns exist in a database (handles migration drift). */
export async function detectSupportedEnterpriseSettingsFields(
  prisma: PrismaClient,
): Promise<EnterpriseSettingsFieldName[]> {
  const supported: EnterpriseSettingsFieldName[] = [];
  for (const field of ENTERPRISE_SETTINGS_FIELD_NAMES) {
    try {
      await prisma.advisorEnterprise.findFirst({
        select: { [field]: true },
      });
      supported.push(field);
    } catch {
      // Column not migrated yet on this database.
    }
  }
  return supported;
}

export function pickEnterpriseSettingsValues<T extends Record<string, unknown>>(
  row: T,
  fields: Iterable<EnterpriseSettingsFieldName>,
): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in row) {
      picked[field] = row[field];
    }
  }
  return picked;
}
