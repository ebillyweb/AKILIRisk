import "server-only";

import { AdvisorQuestionSource, Prisma } from "@prisma/client";

import { ADVISOR_BRANDING_PROFILE_SELECT } from "@/lib/client/advisor-branding-profile";
import { ENTERPRISE_BRANDING_SELECT } from "@/lib/enterprise/branding";
import { ensureEnterprisePlatformRecommendationRulesInTx } from "@/lib/methodology/clone-enterprise-defaults";
import { transferAdvisorMethodologyToEnterpriseInTx } from "@/lib/methodology/clone-enterprise-methodology";

type TransferTx = Prisma.TransactionClient;

export type TransferAdvisorAssetsResult = {
  brandingUpdated: boolean;
  customRulesTransferred: number;
  solutionCustomizationsTransferred: number;
  methodologyProfilesUpdated: number;
  methodologyRowsTransferred: number;
};

type BrandingRow = {
  brandName: string | null;
  tagline: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  logoUrl: string | null;
  logoS3Key: string | null;
  logoContentType: string | null;
  logoFileSize: number | null;
  logoUploadedAt: Date | null;
  websiteUrl: string | null;
  emailFooterText: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  brandingEnabled: boolean;
  customDomainEnabled: boolean;
};

type AdvisorBrandingSource = BrandingRow & {
  firmName: string | null;
};

function isBlank(value: string | null | undefined): boolean {
  return value == null || value.trim() === "";
}

function hasEnterpriseLogo(enterprise: BrandingRow): boolean {
  return Boolean(enterprise.logoUrl?.trim() || enterprise.logoS3Key?.trim());
}

/**
 * Fill empty enterprise branding fields from an advisor profile.
 * Exported for unit tests.
 */
export function buildEnterpriseBrandingTransferUpdate(
  enterprise: BrandingRow,
  advisor: AdvisorBrandingSource,
): Prisma.AdvisorEnterpriseUpdateInput | null {
  if (!advisor.brandingEnabled) return null;

  const advisorBrandName =
    advisor.brandName?.trim() || advisor.firmName?.trim() || null;

  const data: Prisma.AdvisorEnterpriseUpdateInput = {};

  if (isBlank(enterprise.brandName) && advisorBrandName) {
    data.brandName = advisorBrandName;
  }
  if (isBlank(enterprise.tagline) && !isBlank(advisor.tagline)) {
    data.tagline = advisor.tagline!.trim();
  }
  if (isBlank(enterprise.primaryColor) && !isBlank(advisor.primaryColor)) {
    data.primaryColor = advisor.primaryColor!.trim();
  }
  if (isBlank(enterprise.secondaryColor) && !isBlank(advisor.secondaryColor)) {
    data.secondaryColor = advisor.secondaryColor!.trim();
  }
  if (isBlank(enterprise.accentColor) && !isBlank(advisor.accentColor)) {
    data.accentColor = advisor.accentColor!.trim();
  }
  if (!hasEnterpriseLogo(enterprise) && (advisor.logoUrl || advisor.logoS3Key)) {
    data.logoUrl = advisor.logoUrl;
    data.logoS3Key = advisor.logoS3Key;
    data.logoContentType = advisor.logoContentType;
    data.logoFileSize = advisor.logoFileSize;
    data.logoUploadedAt = advisor.logoUploadedAt;
  }
  if (isBlank(enterprise.websiteUrl) && !isBlank(advisor.websiteUrl)) {
    data.websiteUrl = advisor.websiteUrl!.trim();
  }
  if (isBlank(enterprise.emailFooterText) && !isBlank(advisor.emailFooterText)) {
    data.emailFooterText = advisor.emailFooterText!.trim();
  }
  if (isBlank(enterprise.supportEmail) && !isBlank(advisor.supportEmail)) {
    data.supportEmail = advisor.supportEmail!.trim();
  }
  if (isBlank(enterprise.supportPhone) && !isBlank(advisor.supportPhone)) {
    data.supportPhone = advisor.supportPhone!.trim();
  }
  if (!enterprise.customDomainEnabled && advisor.customDomainEnabled) {
    data.customDomainEnabled = true;
  }
  if (!enterprise.brandingEnabled && advisor.brandingEnabled) {
    data.brandingEnabled = true;
  }

  return Object.keys(data).length > 0 ? data : null;
}

/**
 * Promote a solo advisor's branding, methodology, and guidance overlays to the
 * enterprise record when they become a firm owner or administrator.
 */
export async function transferAdvisorAssetsToEnterprise(
  tx: TransferTx,
  advisorProfileId: string,
  enterpriseId: string,
): Promise<TransferAdvisorAssetsResult> {
  const [enterprise, advisor] = await Promise.all([
    tx.advisorEnterprise.findUnique({
      where: { id: enterpriseId },
      select: ENTERPRISE_BRANDING_SELECT,
    }),
    tx.advisorProfile.findUnique({
      where: { id: advisorProfileId },
      select: ADVISOR_BRANDING_PROFILE_SELECT,
    }),
  ]);

  if (!enterprise || !advisor) {
    return {
      brandingUpdated: false,
      customRulesTransferred: 0,
      solutionCustomizationsTransferred: 0,
      methodologyProfilesUpdated: 0,
      methodologyRowsTransferred: 0,
    };
  }

  let brandingUpdated = false;
  const brandingUpdate = buildEnterpriseBrandingTransferUpdate(enterprise, advisor);
  if (brandingUpdate) {
    await tx.advisorEnterprise.update({
      where: { id: enterpriseId },
      data: brandingUpdate,
    });
    brandingUpdated = true;
  }

  await ensureEnterprisePlatformRecommendationRulesInTx(tx, enterpriseId);
  await linkAdvisorPlatformRulesToEnterprise(tx, advisorProfileId, enterpriseId);

  const customRulesTransferred = await transferCustomRecommendationRules(
    tx,
    advisorProfileId,
    enterpriseId,
  );

  const solutionCustomizationsTransferred = await transferSolutionCustomizations(
    tx,
    advisorProfileId,
    enterpriseId,
  );

  const methodologyRowsTransferred = await transferAdvisorMethodologyToEnterpriseInTx(
    tx,
    advisorProfileId,
    enterpriseId,
  );

  return {
    brandingUpdated,
    customRulesTransferred,
    solutionCustomizationsTransferred,
    methodologyProfilesUpdated: 0,
    methodologyRowsTransferred,
  };
}

async function transferCustomRecommendationRules(
  tx: TransferTx,
  advisorProfileId: string,
  enterpriseId: string,
): Promise<number> {
  const customRules = await tx.advisorRecommendationRule.findMany({
    where: {
      advisorProfileId,
      sourceKind: AdvisorQuestionSource.CUSTOM,
      isActive: true,
    },
    orderBy: { priority: "desc" },
  });

  let transferred = 0;

  for (const rule of customRules) {
    const entRule = await tx.enterpriseRecommendationRule.create({
      data: {
        enterpriseId,
        pillarId: rule.pillarId,
        sourceKind: AdvisorQuestionSource.CUSTOM,
        name: rule.name,
        triggerConditions: rule.triggerConditions as Prisma.InputJsonValue,
        servicePayload: rule.servicePayload as Prisma.InputJsonValue,
        priority: rule.priority,
        isActive: true,
      },
    });

    await tx.advisorRecommendationRule.update({
      where: { id: rule.id },
      data: {
        sourceKind: AdvisorQuestionSource.ENTERPRISE,
        enterpriseSourceId: entRule.id,
        version: { increment: 1 },
      },
    });

    transferred++;
  }

  return transferred;
}

async function linkAdvisorPlatformRulesToEnterprise(
  tx: TransferTx,
  advisorProfileId: string,
  enterpriseId: string,
): Promise<void> {
  const [enterpriseRules, advisorRules] = await Promise.all([
    tx.enterpriseRecommendationRule.findMany({
      where: {
        enterpriseId,
        sourceKind: AdvisorQuestionSource.PLATFORM,
        platformSourceId: { not: null },
      },
      select: { id: true, platformSourceId: true },
    }),
    tx.advisorRecommendationRule.findMany({
      where: {
        advisorProfileId,
        sourceKind: AdvisorQuestionSource.PLATFORM,
        platformSourceId: { not: null },
        enterpriseSourceId: null,
      },
      select: { id: true, platformSourceId: true },
    }),
  ]);

  const enterpriseByPlatformSource = new Map(
    enterpriseRules
      .filter((rule) => rule.platformSourceId != null)
      .map((rule) => [rule.platformSourceId!, rule.id]),
  );

  for (const advisorRule of advisorRules) {
    const enterpriseRuleId = enterpriseByPlatformSource.get(advisorRule.platformSourceId!);
    if (!enterpriseRuleId) continue;

    await tx.advisorRecommendationRule.update({
      where: { id: advisorRule.id },
      data: {
        enterpriseSourceId: enterpriseRuleId,
        version: { increment: 1 },
      },
    });
  }
}

async function transferSolutionCustomizations(
  tx: TransferTx,
  advisorProfileId: string,
  enterpriseId: string,
): Promise<number> {
  const advisorOverlays = await tx.advisorSolutionCustomization.findMany({
    where: { advisorProfileId, isActive: true },
  });

  let transferred = 0;

  for (const overlay of advisorOverlays) {
    const existing = await tx.enterpriseSolutionCustomization.findUnique({
      where: {
        enterpriseId_serviceRecommendationId: {
          enterpriseId,
          serviceRecommendationId: overlay.serviceRecommendationId,
        },
      },
    });
    if (existing) continue;

    await tx.enterpriseSolutionCustomization.create({
      data: {
        enterpriseId,
        serviceRecommendationId: overlay.serviceRecommendationId,
        costOverride: overlay.costOverride,
        timeframeOverride: overlay.timeframeOverride,
        providerOverride: overlay.providerOverride,
        additionalPlaybook: overlay.additionalPlaybook as Prisma.InputJsonValue | undefined,
        notes: overlay.notes,
        isActive: true,
      },
    });
    transferred++;
  }

  return transferred;
}
