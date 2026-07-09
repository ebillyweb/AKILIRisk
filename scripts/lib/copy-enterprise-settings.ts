import {
  CopyObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { Prisma, PrismaClient } from "@prisma/client";

import { resolveAwsCredentials } from "../../src/lib/s3/aws-credentials";
import type { ScriptPrismaBundle } from "./prisma-from-url";

/** AdvisorEnterprise columns copied from preview → production (not billing or identity). */
export const ENTERPRISE_SETTINGS_UPDATE_SELECT = {
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
  brandingEnabled: true,
  implementationTrackingEnabled: true,
  advisorMemberPortfolioVisible: true,
  advisorMemberAssessmentLeadsVisible: true,
  advisorMemberMethodologyVisible: true,
  advisorMemberEngagementsVisible: true,
  advisorMemberReassessmentVisible: true,
  advisorMemberProductToursVisible: true,
  advisorMemberHideTierLockedNav: true,
  advisorMemberSkipIntakeEnabled: true,
  advisorMemberSkipPostIntakeReviewEnabled: true,
  advisorMemberDocumentRequirementsEnabled: true,
  advisorMemberActionPlanEnabled: true,
  advisorMemberPersonalBrandingEnabled: true,
  advisorMemberSubdomainEditable: true,
  advisorMemberPseudonymousLabelingDefault: true,
  advisorMemberCollectClientLegalNameDefault: true,
  advisorMemberClientDataPolicyLocked: true,
  intakeQuestionBankMode: true,
  assessmentQuestionBankMode: true,
  defaultCadenceFrequency: true,
  customDomainEnabled: true,
} as const;

type EnterpriseSettingsPayload = Prisma.AdvisorEnterpriseGetPayload<{
  select: typeof ENTERPRISE_SETTINGS_UPDATE_SELECT;
}>;

export type PlatformReferenceMaps = {
  pillarIdBySlug: Map<string, string>;
  sourcePillarSlugById: Map<string, string>;
  platformQuestionIdByKey: Map<string, string>;
  serviceRecommendationIdByKey: Map<string, string>;
  recommendationRuleIdByKey: Map<string, string>;
};

export type CopyEnterpriseSettingsOptions = {
  slug: string;
  dryRun: boolean;
  copyLogo: boolean;
  syncMembers: boolean;
  source: ScriptPrismaBundle;
  target: ScriptPrismaBundle;
  sourceEnvPath: string;
  targetEnvPath: string;
};

export type CopyEnterpriseSettingsResult = {
  sourceEnterpriseId: string;
  targetEnterpriseId: string;
  summary: Record<string, number | string | boolean>;
};

function platformQuestionKey(input: {
  categoryCode: string;
  sectionCode: string;
  questionNumber: string | null;
}): string {
  return `${input.categoryCode}\t${input.sectionCode}\t${input.questionNumber ?? ""}`;
}

function serviceRecommendationKey(input: {
  slug: string | null;
  name: string;
  category: string;
}): string {
  if (input.slug?.trim()) return `slug:${input.slug.trim()}`;
  return `name:${input.name.trim()}\t${input.category.trim()}`;
}

function recommendationRuleKey(serviceKey: string, ruleName: string): string {
  return `${serviceKey}\t${ruleName.trim()}`;
}

export async function buildPlatformReferenceMaps(
  prisma: PrismaClient,
): Promise<PlatformReferenceMaps> {
  const [pillars, platformQuestions, services, rules] = await Promise.all([
    prisma.pillar.findMany({ select: { id: true, slug: true } }),
    prisma.pillarQuestion.findMany({
      select: {
        id: true,
        questionNumber: true,
        section: {
          select: {
            code: true,
            category: { select: { code: true } },
          },
        },
      },
    }),
    prisma.serviceRecommendation.findMany({
      select: { id: true, slug: true, name: true, category: true },
    }),
    prisma.recommendationRule.findMany({
      select: {
        id: true,
        ruleName: true,
        serviceRecommendation: {
          select: { slug: true, name: true, category: true },
        },
      },
    }),
  ]);

  const pillarIdBySlug = new Map(pillars.map((p) => [p.slug, p.id]));
  const sourcePillarSlugById = new Map(pillars.map((p) => [p.id, p.slug]));

  const platformQuestionIdByKey = new Map<string, string>();
  for (const row of platformQuestions) {
    platformQuestionIdByKey.set(
      platformQuestionKey({
        categoryCode: row.section.category.code,
        sectionCode: row.section.code,
        questionNumber: row.questionNumber,
      }),
      row.id,
    );
  }

  const serviceRecommendationIdByKey = new Map<string, string>();
  for (const row of services) {
    serviceRecommendationIdByKey.set(
      serviceRecommendationKey(row),
      row.id,
    );
  }

  const recommendationRuleIdByKey = new Map<string, string>();
  for (const row of rules) {
    const serviceKey = serviceRecommendationKey(row.serviceRecommendation);
    recommendationRuleIdByKey.set(
      recommendationRuleKey(serviceKey, row.ruleName),
      row.id,
    );
  }

  return {
    pillarIdBySlug,
    sourcePillarSlugById,
    platformQuestionIdByKey,
    serviceRecommendationIdByKey,
    recommendationRuleIdByKey,
  };
}

function remapPillarId(
  sourcePillarId: string,
  sourceMaps: PlatformReferenceMaps,
  targetMaps: PlatformReferenceMaps,
): string {
  const slug = sourceMaps.sourcePillarSlugById.get(sourcePillarId);
  if (!slug) {
    throw new Error(`Unknown source pillar id ${sourcePillarId}`);
  }
  const targetId = targetMaps.pillarIdBySlug.get(slug);
  if (!targetId) {
    throw new Error(`Pillar slug "${slug}" missing on target database`);
  }
  return targetId;
}

function remapPillarIds(
  sourceIds: string[],
  sourceMaps: PlatformReferenceMaps,
  targetMaps: PlatformReferenceMaps,
): string[] {
  return sourceIds.map((id) => remapPillarId(id, sourceMaps, targetMaps));
}

function remapPlatformQuestionId(
  sourcePlatformQuestionId: string | null | undefined,
  sourceMaps: PlatformReferenceMaps,
  targetMaps: PlatformReferenceMaps,
): string | null {
  if (!sourcePlatformQuestionId) return null;

  for (const [key, sourceId] of sourceMaps.platformQuestionIdByKey.entries()) {
    if (sourceId !== sourcePlatformQuestionId) continue;
    const targetId = targetMaps.platformQuestionIdByKey.get(key);
    if (!targetId) {
      throw new Error(`Platform question "${key}" missing on target database`);
    }
    return targetId;
  }

  throw new Error(
    `Platform question id ${sourcePlatformQuestionId} not found in source catalog`,
  );
}

function remapServiceRecommendationId(
  sourceServiceId: string,
  sourceMaps: PlatformReferenceMaps,
  targetMaps: PlatformReferenceMaps,
): string {
  for (const [key, sourceId] of sourceMaps.serviceRecommendationIdByKey.entries()) {
    if (sourceId !== sourceServiceId) continue;
    const targetId = targetMaps.serviceRecommendationIdByKey.get(key);
    if (!targetId) {
      throw new Error(`Service recommendation "${key}" missing on target database`);
    }
    return targetId;
  }
  throw new Error(`Service recommendation id ${sourceServiceId} not found in source catalog`);
}

function remapRecommendationRuleId(
  sourceRuleId: string | null | undefined,
  sourceMaps: PlatformReferenceMaps,
  targetMaps: PlatformReferenceMaps,
): string | null {
  if (!sourceRuleId) return null;

  for (const [key, sourceId] of sourceMaps.recommendationRuleIdByKey.entries()) {
    if (sourceId !== sourceRuleId) continue;
    const targetId = targetMaps.recommendationRuleIdByKey.get(key);
    if (!targetId) {
      throw new Error(`Recommendation rule "${key}" missing on target database`);
    }
    return targetId;
  }

  throw new Error(`Recommendation rule id ${sourceRuleId} not found in source catalog`);
}

async function loadEnterpriseBySlug(
  prisma: PrismaClient,
  slug: string,
  databaseLabel: string,
) {
  const enterprise = await prisma.advisorEnterprise.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      ...ENTERPRISE_SETTINGS_UPDATE_SELECT,
    },
  });
  if (!enterprise) {
    throw new Error(`Enterprise slug "${slug}" not found on ${databaseLabel} database`);
  }
  return enterprise;
}

async function copyEnterpriseRowSettings(
  target: PrismaClient,
  targetEnterpriseId: string,
  settings: EnterpriseSettingsPayload,
  dryRun: boolean,
): Promise<void> {
  if (dryRun) return;
  await target.advisorEnterprise.update({
    where: { id: targetEnterpriseId },
    data: settings,
  });
}

async function copyHouseholdProfilesPolicy(
  source: PrismaClient,
  target: PrismaClient,
  sourceEnterpriseId: string,
  targetEnterpriseId: string,
  dryRun: boolean,
): Promise<boolean | null> {
  const ownerProfile = await source.advisorProfile.findFirst({
    where: {
      enterpriseId: sourceEnterpriseId,
      enterpriseMembership: { role: "OWNER", status: "ACTIVE" },
    },
    select: { householdProfilesEnabled: true },
  });
  const enabled =
    ownerProfile?.householdProfilesEnabled ??
    (
      await source.advisorProfile.findFirst({
        where: { enterpriseId: sourceEnterpriseId },
        select: { householdProfilesEnabled: true },
      })
    )?.householdProfilesEnabled ??
    true;

  if (dryRun) return enabled;
  await target.advisorProfile.updateMany({
    where: { enterpriseId: targetEnterpriseId },
    data: { householdProfilesEnabled: enabled },
  });
  return enabled;
}

async function copyPillarOverrides(
  source: PrismaClient,
  target: PrismaClient,
  sourceEnterpriseId: string,
  targetEnterpriseId: string,
  sourceMaps: PlatformReferenceMaps,
  targetMaps: PlatformReferenceMaps,
  dryRun: boolean,
): Promise<number> {
  const rows = await source.enterprisePillarOverride.findMany({
    where: { enterpriseId: sourceEnterpriseId },
  });

  const keepPillarIds = new Set<string>();
  for (const row of rows) {
    const pillarId = remapPillarId(row.pillarId, sourceMaps, targetMaps);
    keepPillarIds.add(pillarId);
    const data = {
      isActive: row.isActive,
      displayName: row.displayName,
      weight: row.weight,
      threshold: row.threshold as Prisma.InputJsonValue,
      sectionWeights: row.sectionWeights as Prisma.InputJsonValue | undefined,
      emphasisMultiplier: row.emphasisMultiplier,
      displayOrder: row.displayOrder,
    };
    if (!dryRun) {
      await target.enterprisePillarOverride.upsert({
        where: {
          enterpriseId_pillarId: { enterpriseId: targetEnterpriseId, pillarId },
        },
        create: { enterpriseId: targetEnterpriseId, pillarId, ...data },
        update: { ...data, version: { increment: 1 } },
      });
    }
  }

  if (!dryRun) {
    await target.enterprisePillarOverride.deleteMany({
      where: {
        enterpriseId: targetEnterpriseId,
        pillarId: { notIn: [...keepPillarIds] },
      },
    });
  }

  return rows.length;
}

async function copyPillarNarratives(
  source: PrismaClient,
  target: PrismaClient,
  sourceEnterpriseId: string,
  targetEnterpriseId: string,
  sourceMaps: PlatformReferenceMaps,
  targetMaps: PlatformReferenceMaps,
  dryRun: boolean,
): Promise<number> {
  const rows = await source.enterprisePillarNarrative.findMany({
    where: { enterpriseId: sourceEnterpriseId },
  });

  const keepPillarIds = new Set<string>();
  for (const row of rows) {
    const pillarId = remapPillarId(row.pillarId, sourceMaps, targetMaps);
    keepPillarIds.add(pillarId);
    const data = {
      allNegative: row.allNegative as Prisma.InputJsonValue,
      allYes: row.allYes as Prisma.InputJsonValue,
      midBand: row.midBand as Prisma.InputJsonValue,
    };
    if (!dryRun) {
      await target.enterprisePillarNarrative.upsert({
        where: {
          enterpriseId_pillarId: { enterpriseId: targetEnterpriseId, pillarId },
        },
        create: { enterpriseId: targetEnterpriseId, pillarId, ...data },
        update: { ...data, version: { increment: 1 } },
      });
    }
  }

  if (!dryRun) {
    await target.enterprisePillarNarrative.deleteMany({
      where: {
        enterpriseId: targetEnterpriseId,
        pillarId: { notIn: [...keepPillarIds] },
      },
    });
  }

  return rows.length;
}

function assessmentQuestionMatchKey(input: {
  pillarId: string;
  sectionCode: string;
  displayOrder: number;
  questionNumber: string | null;
  questionText: string;
}): string {
  return [
    input.pillarId,
    input.sectionCode,
    String(input.displayOrder),
    input.questionNumber ?? "",
    input.questionText.slice(0, 120),
  ].join("\t");
}

async function copyAssessmentQuestions(
  source: PrismaClient,
  target: PrismaClient,
  sourceEnterpriseId: string,
  targetEnterpriseId: string,
  sourceMaps: PlatformReferenceMaps,
  targetMaps: PlatformReferenceMaps,
  dryRun: boolean,
): Promise<number> {
  const [sourceRows, targetRows] = await Promise.all([
    source.enterprisePillarQuestion.findMany({ where: { enterpriseId: sourceEnterpriseId } }),
    target.enterprisePillarQuestion.findMany({
      where: { enterpriseId: targetEnterpriseId },
      select: {
        id: true,
        pillarId: true,
        sectionCode: true,
        displayOrder: true,
        questionNumber: true,
        questionText: true,
        platformSourceId: true,
      },
    }),
  ]);

  const targetByPlatformSource = new Map(
    targetRows
      .filter((row) => row.platformSourceId)
      .map((row) => [row.platformSourceId!, row.id]),
  );
  const targetByCustomKey = new Map(
    targetRows.map((row) => [
      assessmentQuestionMatchKey(row),
      row.id,
    ]),
  );

  const keepIds = new Set<string>();
  for (const row of sourceRows) {
    const pillarId = remapPillarId(row.pillarId, sourceMaps, targetMaps);
    const platformSourceId = remapPlatformQuestionId(
      row.platformSourceId,
      sourceMaps,
      targetMaps,
    );
    const relatedPillarIds = remapPillarIds(
      row.relatedPillarIds,
      sourceMaps,
      targetMaps,
    );
    const data = {
      pillarId,
      sourceKind: row.sourceKind,
      platformSourceId,
      sectionCode: row.sectionCode,
      displayOrder: row.displayOrder,
      questionNumber: row.questionNumber,
      questionText: row.questionText,
      answerType: row.answerType,
      scoreMap: row.scoreMap as Prisma.InputJsonValue,
      answer0: row.answer0,
      answer1: row.answer1,
      answer2: row.answer2,
      answer3: row.answer3,
      whyThisMatters: row.whyThisMatters,
      recommendedActions: row.recommendedActions,
      isVisible: row.isVisible,
      isKeyRiskIndicator: row.isKeyRiskIndicator,
      relatedPillarIds,
    };

    const existingId =
      (platformSourceId ? targetByPlatformSource.get(platformSourceId) : undefined) ??
      targetByCustomKey.get(
        assessmentQuestionMatchKey({
          pillarId,
          sectionCode: row.sectionCode,
          displayOrder: row.displayOrder,
          questionNumber: row.questionNumber,
          questionText: row.questionText,
        }),
      );

    if (dryRun) {
      if (existingId) keepIds.add(existingId);
      continue;
    }

    if (existingId) {
      keepIds.add(existingId);
      await target.enterprisePillarQuestion.update({
        where: { id: existingId },
        data: { ...data, version: { increment: 1 } },
      });
      continue;
    }

    const created = await target.enterprisePillarQuestion.create({
      data: { enterpriseId: targetEnterpriseId, ...data },
      select: { id: true },
    });
    keepIds.add(created.id);
  }

  if (!dryRun) {
    await target.enterprisePillarQuestion.deleteMany({
      where: {
        enterpriseId: targetEnterpriseId,
        id: { notIn: [...keepIds] },
      },
    });
  }

  return sourceRows.length;
}

function intakeQuestionMatchKey(input: {
  displayOrder: number;
  questionNumber: string | null;
  questionText: string;
}): string {
  return [
    String(input.displayOrder),
    input.questionNumber ?? "",
    input.questionText.slice(0, 120),
  ].join("\t");
}

async function copyIntakeQuestions(
  source: PrismaClient,
  target: PrismaClient,
  sourceEnterpriseId: string,
  targetEnterpriseId: string,
  sourceMaps: PlatformReferenceMaps,
  targetMaps: PlatformReferenceMaps,
  dryRun: boolean,
): Promise<number> {
  const [sourceRows, targetRows] = await Promise.all([
    source.enterpriseIntakeQuestion.findMany({ where: { enterpriseId: sourceEnterpriseId } }),
    target.enterpriseIntakeQuestion.findMany({
      where: { enterpriseId: targetEnterpriseId },
      select: {
        id: true,
        displayOrder: true,
        questionNumber: true,
        questionText: true,
        platformSourceId: true,
      },
    }),
  ]);

  const targetByPlatformSource = new Map(
    targetRows
      .filter((row) => row.platformSourceId)
      .map((row) => [row.platformSourceId!, row.id]),
  );
  const targetByCustomKey = new Map(
    targetRows.map((row) => [intakeQuestionMatchKey(row), row.id]),
  );

  const keepIds = new Set<string>();
  for (const row of sourceRows) {
    const platformSourceId = remapPlatformQuestionId(
      row.platformSourceId,
      sourceMaps,
      targetMaps,
    );
    const relatedPillarIds = remapPillarIds(
      row.relatedPillarIds,
      sourceMaps,
      targetMaps,
    );
    const data = {
      sourceKind: row.sourceKind,
      platformSourceId,
      displayOrder: row.displayOrder,
      questionNumber: row.questionNumber,
      questionText: row.questionText,
      context: row.context,
      helpText: row.helpText,
      learnMore: row.learnMore,
      answerType: row.answerType,
      answer0: row.answer0,
      answer1: row.answer1,
      answer2: row.answer2,
      answer3: row.answer3,
      options: row.options as Prisma.InputJsonValue | undefined,
      relatedPillarIds,
      recommendedActions: row.recommendedActions,
      isVisible: row.isVisible,
    };

    const existingId =
      (platformSourceId ? targetByPlatformSource.get(platformSourceId) : undefined) ??
      targetByCustomKey.get(
        intakeQuestionMatchKey({
          displayOrder: row.displayOrder,
          questionNumber: row.questionNumber,
          questionText: row.questionText,
        }),
      );

    if (dryRun) {
      if (existingId) keepIds.add(existingId);
      continue;
    }

    if (existingId) {
      keepIds.add(existingId);
      await target.enterpriseIntakeQuestion.update({
        where: { id: existingId },
        data: { ...data, version: { increment: 1 } },
      });
      continue;
    }

    const created = await target.enterpriseIntakeQuestion.create({
      data: { enterpriseId: targetEnterpriseId, ...data },
      select: { id: true },
    });
    keepIds.add(created.id);
  }

  if (!dryRun) {
    await target.enterpriseIntakeQuestion.deleteMany({
      where: {
        enterpriseId: targetEnterpriseId,
        id: { notIn: [...keepIds] },
      },
    });
  }

  return sourceRows.length;
}

async function copyRecommendationRules(
  source: PrismaClient,
  target: PrismaClient,
  sourceEnterpriseId: string,
  targetEnterpriseId: string,
  sourceMaps: PlatformReferenceMaps,
  targetMaps: PlatformReferenceMaps,
  dryRun: boolean,
): Promise<number> {
  const [sourceRows, targetRows] = await Promise.all([
    source.enterpriseRecommendationRule.findMany({ where: { enterpriseId: sourceEnterpriseId } }),
    target.enterpriseRecommendationRule.findMany({
      where: { enterpriseId: targetEnterpriseId },
      select: { id: true, name: true, platformSourceId: true },
    }),
  ]);

  const targetByPlatformSource = new Map(
    targetRows
      .filter((row) => row.platformSourceId)
      .map((row) => [row.platformSourceId!, row.id]),
  );
  const targetByName = new Map(targetRows.map((row) => [row.name.trim(), row.id]));

  const keepIds = new Set<string>();
  for (const row of sourceRows) {
    const pillarId = row.pillarId
      ? remapPillarId(row.pillarId, sourceMaps, targetMaps)
      : null;
    const platformSourceId = remapRecommendationRuleId(
      row.platformSourceId,
      sourceMaps,
      targetMaps,
    );
    const data = {
      pillarId,
      sourceKind: row.sourceKind,
      platformSourceId,
      name: row.name,
      triggerConditions: row.triggerConditions as Prisma.InputJsonValue,
      servicePayload: row.servicePayload as Prisma.InputJsonValue,
      priority: row.priority,
      isActive: row.isActive,
    };

    const existingId =
      (platformSourceId ? targetByPlatformSource.get(platformSourceId) : undefined) ??
      targetByName.get(row.name.trim());

    if (dryRun) {
      if (existingId) keepIds.add(existingId);
      continue;
    }

    if (existingId) {
      keepIds.add(existingId);
      await target.enterpriseRecommendationRule.update({
        where: { id: existingId },
        data: { ...data, version: { increment: 1 } },
      });
      continue;
    }

    const created = await target.enterpriseRecommendationRule.create({
      data: { enterpriseId: targetEnterpriseId, ...data },
      select: { id: true },
    });
    keepIds.add(created.id);
  }

  if (!dryRun) {
    await target.enterpriseRecommendationRule.deleteMany({
      where: {
        enterpriseId: targetEnterpriseId,
        id: { notIn: [...keepIds] },
      },
    });
  }

  return sourceRows.length;
}

async function copySolutionCustomizations(
  source: PrismaClient,
  target: PrismaClient,
  sourceEnterpriseId: string,
  targetEnterpriseId: string,
  sourceMaps: PlatformReferenceMaps,
  targetMaps: PlatformReferenceMaps,
  dryRun: boolean,
): Promise<number> {
  const sourceRows = await source.enterpriseSolutionCustomization.findMany({
    where: { enterpriseId: sourceEnterpriseId },
  });

  const keepServiceIds = new Set<string>();
  for (const row of sourceRows) {
    const serviceRecommendationId = remapServiceRecommendationId(
      row.serviceRecommendationId,
      sourceMaps,
      targetMaps,
    );
    keepServiceIds.add(serviceRecommendationId);
    const data = {
      costOverride: row.costOverride,
      timeframeOverride: row.timeframeOverride,
      providerOverride: row.providerOverride,
      additionalPlaybook: row.additionalPlaybook as Prisma.InputJsonValue | undefined,
      notes: row.notes,
      isActive: row.isActive,
      isRequired: row.isRequired,
      priorityAdjustment: row.priorityAdjustment,
      complianceDisclosures: row.complianceDisclosures,
      customGuidance: row.customGuidance,
      internalLinks: row.internalLinks as Prisma.InputJsonValue | undefined,
    };

    if (dryRun) continue;

    await target.enterpriseSolutionCustomization.upsert({
      where: {
        enterpriseId_serviceRecommendationId: {
          enterpriseId: targetEnterpriseId,
          serviceRecommendationId,
        },
      },
      create: {
        enterpriseId: targetEnterpriseId,
        serviceRecommendationId,
        ...data,
      },
      update: data,
    });
  }

  if (!dryRun) {
    await target.enterpriseSolutionCustomization.deleteMany({
      where: {
        enterpriseId: targetEnterpriseId,
        serviceRecommendationId: { notIn: [...keepServiceIds] },
      },
    });
  }

  return sourceRows.length;
}

async function copyLogoObject(
  logoS3Key: string | null | undefined,
  sourceEnvPath: string,
  targetEnvPath: string,
  dryRun: boolean,
): Promise<"skipped" | "copied" | "already-present"> {
  if (!logoS3Key?.trim()) return "skipped";

  const { readEnvFileValue } = await import("./parse-env-file");
  const sourceBucket = readEnvFileValue(sourceEnvPath, "S3_BRANDING_BUCKET")?.trim();
  const targetBucket = readEnvFileValue(targetEnvPath, "S3_BRANDING_BUCKET")?.trim();
  const region =
    readEnvFileValue(targetEnvPath, "S3_BRANDING_REGION")?.trim() ||
    readEnvFileValue(sourceEnvPath, "S3_BRANDING_REGION")?.trim() ||
    process.env.AWS_REGION?.trim() ||
    "us-east-2";

  if (!sourceBucket || !targetBucket) {
    throw new Error(
      "S3_BRANDING_BUCKET must be set in both source and target env files to copy logos",
    );
  }

  const client = new S3Client({
    region,
    followRegionRedirects: true,
    credentials: resolveAwsCredentials(),
  });

  try {
    await client.send(new HeadObjectCommand({ Bucket: targetBucket, Key: logoS3Key }));
    return "already-present";
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
      ?.httpStatusCode;
    if (status !== 404 && status !== 403) {
      throw error;
    }
  }

  if (dryRun) return "copied";

  await client.send(
    new CopyObjectCommand({
      Bucket: targetBucket,
      Key: logoS3Key,
      CopySource: `${sourceBucket}/${encodeURIComponent(logoS3Key).replace(/%2F/g, "/")}`,
    }),
  );
  return "copied";
}

export async function syncEnterpriseMembersMethodology(
  target: PrismaClient,
  enterpriseId: string,
  dryRun: boolean,
): Promise<number> {
  const members = await target.enterpriseMembership.findMany({
    where: { enterpriseId, status: "ACTIVE", advisorProfileId: { not: null } },
    select: { advisorProfileId: true },
  });

  if (dryRun) return members.length;

  let updated = 0;
  for (const member of members) {
    if (!member.advisorProfileId) continue;
    const changed = await target.$transaction(
      async (tx) => syncEnterpriseMethodologyToAdvisorInTx(tx, enterpriseId, member.advisorProfileId!),
      { timeout: 120_000 },
    );
    if (changed) updated += 1;
  }
  return updated;
}

/** Port of syncEnterpriseMethodologyToAdvisorInTx for script use (no server-only import). */
async function syncEnterpriseMethodologyToAdvisorInTx(
  tx: Prisma.TransactionClient,
  enterpriseId: string,
  advisorProfileId: string,
): Promise<boolean> {
  let changed = false;

  const enterprise = await tx.advisorEnterprise.findUnique({
    where: { id: enterpriseId },
    select: { intakeQuestionBankMode: true, assessmentQuestionBankMode: true },
  });
  if (enterprise) {
    const profile = await tx.advisorProfile.findUnique({
      where: { id: advisorProfileId },
      select: { intakeQuestionBankMode: true, assessmentQuestionBankMode: true },
    });
    if (profile?.intakeQuestionBankMode !== enterprise.intakeQuestionBankMode) {
      await tx.advisorProfile.update({
        where: { id: advisorProfileId },
        data: { intakeQuestionBankMode: enterprise.intakeQuestionBankMode },
      });
      changed = true;
    }
    if (profile?.assessmentQuestionBankMode !== enterprise.assessmentQuestionBankMode) {
      await tx.advisorProfile.update({
        where: { id: advisorProfileId },
        data: { assessmentQuestionBankMode: enterprise.assessmentQuestionBankMode },
      });
      changed = true;
    }
  }

  const entOverrides = await tx.enterprisePillarOverride.findMany({ where: { enterpriseId } });
  for (const ent of entOverrides) {
    const existing = await tx.advisorPillarOverride.findUnique({
      where: {
        advisorProfileId_pillarId: { advisorProfileId, pillarId: ent.pillarId },
      },
    });
    const payload = {
      isActive: ent.isActive,
      displayName: ent.displayName,
      weight: ent.weight,
      threshold: ent.threshold as Prisma.InputJsonValue,
      sectionWeights: ent.sectionWeights as Prisma.InputJsonValue | undefined,
      emphasisMultiplier: ent.emphasisMultiplier,
      displayOrder: ent.displayOrder,
      version: { increment: 1 as const },
    };
    if (existing?.enterpriseSourceId === ent.id) {
      await tx.advisorPillarOverride.update({ where: { id: existing.id }, data: payload });
      changed = true;
      continue;
    }
    if (existing && !existing.enterpriseSourceId) {
      await tx.advisorPillarOverride.update({
        where: { id: existing.id },
        data: { enterpriseSourceId: ent.id, ...payload },
      });
      changed = true;
      continue;
    }
    if (!existing) {
      await tx.advisorPillarOverride.create({
        data: {
          advisorProfileId,
          pillarId: ent.pillarId,
          enterpriseSourceId: ent.id,
          isActive: ent.isActive,
          displayName: ent.displayName,
          weight: ent.weight,
          threshold: ent.threshold as Prisma.InputJsonValue,
          sectionWeights: ent.sectionWeights as Prisma.InputJsonValue | undefined,
          emphasisMultiplier: ent.emphasisMultiplier,
          displayOrder: ent.displayOrder,
        },
      });
      changed = true;
    }
  }

  const entNarratives = await tx.enterprisePillarNarrative.findMany({ where: { enterpriseId } });
  for (const ent of entNarratives) {
    await tx.advisorPillarNarrative.upsert({
      where: {
        advisorProfileId_pillarId: { advisorProfileId, pillarId: ent.pillarId },
      },
      create: {
        advisorProfileId,
        pillarId: ent.pillarId,
        enterpriseSourceId: ent.id,
        allNegative: ent.allNegative as Prisma.InputJsonValue,
        allYes: ent.allYes as Prisma.InputJsonValue,
        midBand: ent.midBand as Prisma.InputJsonValue,
      },
      update: {
        enterpriseSourceId: ent.id,
        allNegative: ent.allNegative as Prisma.InputJsonValue,
        allYes: ent.allYes as Prisma.InputJsonValue,
        midBand: ent.midBand as Prisma.InputJsonValue,
        version: { increment: 1 },
      },
    });
    changed = true;
  }

  const entAssess = await tx.enterprisePillarQuestion.findMany({ where: { enterpriseId } });
  const advisorAssess = await tx.advisorPillarQuestion.findMany({
    where: { advisorProfileId },
    select: { id: true, enterpriseSourceId: true },
  });
  const advisorByEntSource = new Map(
    advisorAssess.filter((q) => q.enterpriseSourceId).map((q) => [q.enterpriseSourceId!, q.id]),
  );
  for (const ent of entAssess) {
    const existingId = advisorByEntSource.get(ent.id);
    if (existingId) {
      await tx.advisorPillarQuestion.update({
        where: { id: existingId },
        data: {
          questionText: ent.questionText,
          whyThisMatters: ent.whyThisMatters,
          recommendedActions: ent.recommendedActions,
          isVisible: ent.isVisible,
          displayOrder: ent.displayOrder,
          answerType: ent.answerType,
          scoreMap: ent.scoreMap as Prisma.InputJsonValue,
          answer0: ent.answer0,
          answer1: ent.answer1,
          answer2: ent.answer2,
          answer3: ent.answer3,
          version: { increment: 1 },
        },
      });
      changed = true;
      continue;
    }
    await tx.advisorPillarQuestion.create({
      data: {
        advisorProfileId,
        pillarId: ent.pillarId,
        enterpriseSourceId: ent.id,
        sourceKind: ent.sourceKind === "CUSTOM" ? "ENTERPRISE" : "PLATFORM",
        platformSourceId: ent.platformSourceId,
        sectionCode: ent.sectionCode,
        displayOrder: ent.displayOrder,
        questionNumber: ent.questionNumber,
        questionText: ent.questionText,
        answerType: ent.answerType,
        scoreMap: ent.scoreMap as Prisma.InputJsonValue,
        answer0: ent.answer0,
        answer1: ent.answer1,
        answer2: ent.answer2,
        answer3: ent.answer3,
        whyThisMatters: ent.whyThisMatters,
        recommendedActions: ent.recommendedActions,
        isVisible: ent.isVisible,
        isKeyRiskIndicator: ent.isKeyRiskIndicator,
        relatedPillarIds: ent.relatedPillarIds,
      },
    });
    changed = true;
  }

  const entIntake = await tx.enterpriseIntakeQuestion.findMany({ where: { enterpriseId } });
  const advisorIntake = await tx.advisorIntakeQuestion.findMany({
    where: { advisorProfileId },
    select: { id: true, enterpriseSourceId: true },
  });
  const advisorIntakeByEnt = new Map(
    advisorIntake.filter((q) => q.enterpriseSourceId).map((q) => [q.enterpriseSourceId!, q.id]),
  );
  for (const ent of entIntake) {
    const existingId = advisorIntakeByEnt.get(ent.id);
    if (existingId) {
      await tx.advisorIntakeQuestion.update({
        where: { id: existingId },
        data: {
          questionText: ent.questionText,
          context: ent.context,
          helpText: ent.helpText,
          learnMore: ent.learnMore,
          isVisible: ent.isVisible,
          displayOrder: ent.displayOrder,
          answerType: ent.answerType,
          answer0: ent.answer0,
          answer1: ent.answer1,
          answer2: ent.answer2,
          answer3: ent.answer3,
          options: ent.options as Prisma.InputJsonValue | undefined,
          version: { increment: 1 },
        },
      });
      changed = true;
      continue;
    }
    await tx.advisorIntakeQuestion.create({
      data: {
        advisorProfileId,
        enterpriseSourceId: ent.id,
        sourceKind: ent.sourceKind === "CUSTOM" ? "ENTERPRISE" : "PLATFORM",
        platformSourceId: ent.platformSourceId,
        displayOrder: ent.displayOrder,
        questionNumber: ent.questionNumber,
        questionText: ent.questionText,
        context: ent.context,
        helpText: ent.helpText,
        learnMore: ent.learnMore,
        answerType: ent.answerType,
        answer0: ent.answer0,
        answer1: ent.answer1,
        answer2: ent.answer2,
        answer3: ent.answer3,
        options: ent.options as Prisma.InputJsonValue | undefined,
        relatedPillarIds: ent.relatedPillarIds,
        recommendedActions: ent.recommendedActions,
        isVisible: ent.isVisible,
      },
    });
    changed = true;
  }

  return changed;
}

export async function copyEnterpriseSettings(
  options: CopyEnterpriseSettingsOptions,
): Promise<CopyEnterpriseSettingsResult> {
  const {
    slug,
    dryRun,
    copyLogo,
    syncMembers,
    source,
    target,
    sourceEnvPath,
    targetEnvPath,
  } = options;

  const [sourceEnterprise, targetEnterprise, sourceMaps, targetMaps] = await Promise.all([
    loadEnterpriseBySlug(source.prisma, slug, source.label),
    loadEnterpriseBySlug(target.prisma, slug, target.label),
    buildPlatformReferenceMaps(source.prisma),
    buildPlatformReferenceMaps(target.prisma),
  ]);

  const { id: sourceEnterpriseId, name: sourceName, ...settings } = sourceEnterprise;
  const { id: targetEnterpriseId, name: targetName } = targetEnterprise;

  await copyEnterpriseRowSettings(
    target.prisma,
    targetEnterpriseId,
    settings,
    dryRun,
  );

  const householdProfilesEnabled = await copyHouseholdProfilesPolicy(
    source.prisma,
    target.prisma,
    sourceEnterpriseId,
    targetEnterpriseId,
    dryRun,
  );

  const [
    pillarOverrides,
    pillarNarratives,
    assessmentQuestions,
    intakeQuestions,
    recommendationRules,
    solutionCustomizations,
  ] = await Promise.all([
    copyPillarOverrides(
      source.prisma,
      target.prisma,
      sourceEnterpriseId,
      targetEnterpriseId,
      sourceMaps,
      targetMaps,
      dryRun,
    ),
    copyPillarNarratives(
      source.prisma,
      target.prisma,
      sourceEnterpriseId,
      targetEnterpriseId,
      sourceMaps,
      targetMaps,
      dryRun,
    ),
    copyAssessmentQuestions(
      source.prisma,
      target.prisma,
      sourceEnterpriseId,
      targetEnterpriseId,
      sourceMaps,
      targetMaps,
      dryRun,
    ),
    copyIntakeQuestions(
      source.prisma,
      target.prisma,
      sourceEnterpriseId,
      targetEnterpriseId,
      sourceMaps,
      targetMaps,
      dryRun,
    ),
    copyRecommendationRules(
      source.prisma,
      target.prisma,
      sourceEnterpriseId,
      targetEnterpriseId,
      sourceMaps,
      targetMaps,
      dryRun,
    ),
    copySolutionCustomizations(
      source.prisma,
      target.prisma,
      sourceEnterpriseId,
      targetEnterpriseId,
      sourceMaps,
      targetMaps,
      dryRun,
    ),
  ]);

  let logoResult: "skipped" | "copied" | "already-present" = "skipped";
  if (copyLogo) {
    logoResult = await copyLogoObject(
      settings.logoS3Key,
      sourceEnvPath,
      targetEnvPath,
      dryRun,
    );
  }

  let membersSynced = 0;
  if (syncMembers) {
    membersSynced = await syncEnterpriseMembersMethodology(
      target.prisma,
      targetEnterpriseId,
      dryRun,
    );
  }

  return {
    sourceEnterpriseId,
    targetEnterpriseId,
    summary: {
      dryRun,
      slug,
      sourceName,
      targetName,
      householdProfilesEnabled: householdProfilesEnabled ?? "unchanged",
      pillarOverrides,
      pillarNarratives,
      assessmentQuestions,
      intakeQuestions,
      recommendationRules,
      solutionCustomizations,
      logo: logoResult,
      membersSynced,
    },
  };
}
