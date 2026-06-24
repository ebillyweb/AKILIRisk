import { AdvisorQuestionSource, PillarCategoryKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DEFAULT_RISK_THRESHOLDS } from "@/lib/assessment/governance-rubric";
import {
  pillarQuestionInclude,
  pillarQuestionRowToWire,
  sortPillarQuestionRows,
  type PillarQuestionWithHierarchy,
} from "@/lib/assessment/bank/pillar-question-wire";
import { riskAreaIdForPillarCategory } from "@/lib/assessment/bank/pillar-category-risk-area";
import { narrativeStarterForSlug } from "@/lib/methodology/narrative-starter";
import { PLATFORM_PILLAR_CATALOG } from "@/lib/methodology/pillar-catalog-starter";

export async function cloneAdvisorDefaultsIfNeeded(
  advisorProfileId: string,
  options?: { force?: boolean },
): Promise<boolean> {
  const profile = await prisma.advisorProfile.findUnique({
    where: { id: advisorProfileId },
    select: { starterContentClonedAt: true },
  });
  if (!profile) return false;
  if (profile.starterContentClonedAt && !options?.force) return false;

  const pillars = await prisma.pillar.findMany({
    where: { archivedAt: null },
    orderBy: { defaultOrder: "asc" },
  });
  if (pillars.length === 0) return false;

  const slugToPillarId = new Map(pillars.map((p) => [p.slug, p.id]));

  await prisma.$transaction(
    async (tx) => {
      for (const pillar of pillars) {
        const starter = PLATFORM_PILLAR_CATALOG.find((p) => p.slug === pillar.slug);
        const weight = starter?.defaultWeight ?? 10;
        await tx.advisorPillarOverride.upsert({
          where: {
            advisorProfileId_pillarId: {
              advisorProfileId,
              pillarId: pillar.id,
            },
          },
          create: {
            advisorProfileId,
            pillarId: pillar.id,
            isActive: true,
            weight,
            threshold: DEFAULT_RISK_THRESHOLDS as unknown as Prisma.InputJsonValue,
            emphasisMultiplier: 1.5,
            displayOrder: pillar.defaultOrder,
          },
          update: {},
        });
      }

      const assessCount = await tx.advisorPillarQuestion.count({
        where: { advisorProfileId },
      });
      if (assessCount === 0) {
        await cloneAllPlatformAssessmentQuestions(tx, advisorProfileId, slugToPillarId);
      } else if (options?.force) {
        await syncMissingPlatformAssessmentQuestions(tx, advisorProfileId, slugToPillarId);
      }

      const intakeCount = await tx.advisorIntakeQuestion.count({
        where: { advisorProfileId },
      });
      if (intakeCount === 0) {
        await cloneAllPlatformIntakeQuestions(tx, advisorProfileId, slugToPillarId);
      } else if (options?.force) {
        await syncMissingPlatformIntakeQuestions(tx, advisorProfileId, slugToPillarId);
      }

      for (const pillar of pillars) {
        const existing = await tx.advisorPillarNarrative.findUnique({
          where: {
            advisorProfileId_pillarId: {
              advisorProfileId,
              pillarId: pillar.id,
            },
          },
        });
        if (existing && !options?.force) continue;
        const bands = narrativeStarterForSlug(pillar.slug);
        await tx.advisorPillarNarrative.upsert({
          where: {
            advisorProfileId_pillarId: {
              advisorProfileId,
              pillarId: pillar.id,
            },
          },
          create: {
            advisorProfileId,
            pillarId: pillar.id,
            allNegative: bands.allNegative,
            allYes: bands.allYes,
            midBand: bands.midBand,
          },
          update: options?.force
            ? {
                allNegative: bands.allNegative,
                allYes: bands.allYes,
                midBand: bands.midBand,
                version: { increment: 1 },
              }
            : {},
        });
      }

      const ruleCount = await tx.advisorRecommendationRule.count({
        where: { advisorProfileId },
      });
      if (ruleCount === 0) {
        await cloneAllPlatformRecommendationRules(tx, advisorProfileId, slugToPillarId);
      } else if (options?.force) {
        await syncMissingPlatformRecommendationRules(tx, advisorProfileId, slugToPillarId);
      }

      const catalogVersion = pillars[0]?.catalogVersion ?? 1;
      await tx.advisorProfile.update({
        where: { id: advisorProfileId },
        data: {
          starterContentClonedAt: new Date(),
          catalogVersionSeen: catalogVersion,
        },
      });
    },
    { timeout: 120_000 },
  );

  return true;
}

type CloneTx = Prisma.TransactionClient;

async function cloneAllPlatformAssessmentQuestions(
  tx: CloneTx,
  advisorProfileId: string,
  slugToPillarId: Map<string, string>,
): Promise<void> {
  const assessRows = await loadPlatformAssessmentRows(tx);
  for (const row of sortPillarQuestionRows(assessRows)) {
    await createPlatformAssessmentClone(tx, advisorProfileId, row, slugToPillarId);
  }
}

export async function syncMissingPlatformAssessmentQuestions(
  tx: CloneTx,
  advisorProfileId: string,
  slugToPillarId: Map<string, string>,
): Promise<number> {
  const existing = await tx.advisorPillarQuestion.findMany({
    where: {
      advisorProfileId,
      sourceKind: AdvisorQuestionSource.PLATFORM,
    },
    select: { id: true, platformSourceId: true, pillarId: true, questionNumber: true },
  });
  const known = new Set(
    existing.map((r) => r.platformSourceId).filter((id): id is string => id != null),
  );
  const legacyKeys = new Map<string, string>(
    existing
      .filter((r) => r.platformSourceId == null && r.questionNumber)
      .map((r) => [`${r.pillarId}:${r.questionNumber}`, r.id]),
  );

  const assessRows = await loadPlatformAssessmentRows(tx);
  let added = 0;
  for (const row of sortPillarQuestionRows(assessRows)) {
    if (known.has(row.id)) continue;
    const riskArea = riskAreaIdForPillarCategory(row.section.category);
    if (!riskArea) continue;
    const pillarId = slugToPillarId.get(riskArea);
    if (!pillarId) continue;

    const legacyKey = row.questionNumber ? `${pillarId}:${row.questionNumber}` : null;
    const legacyId = legacyKey ? legacyKeys.get(legacyKey) : undefined;
    if (legacyId) {
      await tx.advisorPillarQuestion.update({
        where: { id: legacyId },
        data: { platformSourceId: row.id },
      });
      known.add(row.id);
      continue;
    }

    await createPlatformAssessmentClone(tx, advisorProfileId, row, slugToPillarId);
    added++;
  }
  return added;
}

async function loadPlatformAssessmentRows(tx: CloneTx): Promise<PillarQuestionWithHierarchy[]> {
  return (await tx.pillarQuestion.findMany({
    where: {
      isVisible: true,
      section: { category: { kind: PillarCategoryKind.ASSESSMENT } },
    },
    include: pillarQuestionInclude,
  })) as PillarQuestionWithHierarchy[];
}

async function createPlatformAssessmentClone(
  tx: CloneTx,
  advisorProfileId: string,
  row: PillarQuestionWithHierarchy,
  slugToPillarId: Map<string, string>,
): Promise<void> {
  const riskArea = riskAreaIdForPillarCategory(row.section.category);
  if (!riskArea) return;
  const pillarId = slugToPillarId.get(riskArea);
  if (!pillarId) return;
  const wire = pillarQuestionRowToWire(row);
  await tx.advisorPillarQuestion.create({
    data: {
      advisorProfileId,
      pillarId,
      sourceKind: AdvisorQuestionSource.PLATFORM,
      platformSourceId: row.id,
      sectionCode: row.section.code,
      displayOrder: row.displayOrder,
      questionNumber: row.questionNumber,
      questionText: row.questionText,
      answerType: row.answerType,
      scoreMap: wire.scoreMap as Prisma.InputJsonValue,
      whyThisMatters: row.whyThisMatters,
      recommendedActions: row.recommendedActions,
      isVisible: row.isVisible,
      isKeyRiskIndicator: row.isKeyRiskIndicator,
      relatedPillarIds: mapRelatedPillarIds(row.relatedPillarIds, slugToPillarId),
    },
  });
}

async function cloneAllPlatformIntakeQuestions(
  tx: CloneTx,
  advisorProfileId: string,
  slugToPillarId: Map<string, string>,
): Promise<void> {
  const intakeRows = await loadPlatformIntakeRows(tx);
  for (const row of sortPillarQuestionRows(intakeRows)) {
    await createPlatformIntakeClone(tx, advisorProfileId, row, slugToPillarId);
  }
}

export async function syncMissingPlatformIntakeQuestions(
  tx: CloneTx,
  advisorProfileId: string,
  slugToPillarId: Map<string, string>,
): Promise<number> {
  const existing = await tx.advisorIntakeQuestion.findMany({
    where: {
      advisorProfileId,
      sourceKind: AdvisorQuestionSource.PLATFORM,
    },
    select: { id: true, platformSourceId: true, questionNumber: true },
  });
  const known = new Set(
    existing.map((r) => r.platformSourceId).filter((id): id is string => id != null),
  );
  const legacyByNumber = new Map<string, string>(
    existing
      .filter((r) => r.platformSourceId == null && r.questionNumber)
      .map((r) => [r.questionNumber!, r.id]),
  );

  const intakeRows = await loadPlatformIntakeRows(tx);
  let added = 0;
  for (const row of sortPillarQuestionRows(intakeRows)) {
    if (known.has(row.id)) continue;

    const legacyId = row.questionNumber ? legacyByNumber.get(row.questionNumber) : undefined;
    if (legacyId) {
      await tx.advisorIntakeQuestion.update({
        where: { id: legacyId },
        data: { platformSourceId: row.id },
      });
      known.add(row.id);
      continue;
    }

    await createPlatformIntakeClone(tx, advisorProfileId, row, slugToPillarId);
    added++;
  }
  return added;
}

async function loadPlatformIntakeRows(tx: CloneTx): Promise<PillarQuestionWithHierarchy[]> {
  return (await tx.pillarQuestion.findMany({
    where: {
      isVisible: true,
      section: { category: { kind: PillarCategoryKind.INTAKE } },
    },
    include: pillarQuestionInclude,
  })) as PillarQuestionWithHierarchy[];
}

async function createPlatformIntakeClone(
  tx: CloneTx,
  advisorProfileId: string,
  row: PillarQuestionWithHierarchy,
  slugToPillarId: Map<string, string>,
): Promise<void> {
  await tx.advisorIntakeQuestion.create({
    data: {
      advisorProfileId,
      sourceKind: AdvisorQuestionSource.PLATFORM,
      platformSourceId: row.id,
      displayOrder: row.displayOrder,
      questionNumber: row.questionNumber,
      questionText: row.questionText,
      context: row.whyThisMatters,
      helpText: row.whyThisMatters,
      learnMore: row.recommendedActions,
      answerType: "audio",
      relatedPillarIds: mapRelatedPillarIds(row.relatedPillarIds, slugToPillarId),
      recommendedActions: row.recommendedActions,
      isVisible: row.isVisible,
    },
  });
}

function mapRelatedPillarIds(
  raw: string[],
  slugToPillarId: Map<string, string>,
): string[] {
  const out: string[] = [];
  const uuidSet = new Set(slugToPillarId.values());
  for (const id of raw) {
    const fromSlug = slugToPillarId.get(id);
    if (fromSlug) out.push(fromSlug);
    else if (uuidSet.has(id)) out.push(id);
  }
  return [...new Set(out)];
}

async function cloneAllPlatformRecommendationRules(
  tx: CloneTx,
  advisorProfileId: string,
  slugToPillarId: Map<string, string>,
): Promise<void> {
  const platformRules = await loadPlatformRecommendationRows(tx);
  for (const rule of platformRules) {
    await createPlatformRecommendationClone(tx, advisorProfileId, rule, slugToPillarId);
  }
}

export async function syncMissingPlatformRecommendationRules(
  tx: CloneTx,
  advisorProfileId: string,
  slugToPillarId: Map<string, string>,
): Promise<number> {
  const existing = await tx.advisorRecommendationRule.findMany({
    where: {
      advisorProfileId,
      sourceKind: AdvisorQuestionSource.PLATFORM,
    },
    select: { id: true, platformSourceId: true, name: true },
  });
  const known = new Set(
    existing.map((r) => r.platformSourceId).filter((id): id is string => id != null),
  );
  const legacyByName = new Map<string, string>(
    existing
      .filter((r) => r.platformSourceId == null)
      .map((r) => [r.name, r.id]),
  );

  const platformRules = await loadPlatformRecommendationRows(tx);
  let added = 0;
  for (const rule of platformRules) {
    if (known.has(rule.id)) continue;

    const legacyId = legacyByName.get(rule.ruleName);
    if (legacyId) {
      await tx.advisorRecommendationRule.update({
        where: { id: legacyId },
        data: { platformSourceId: rule.id },
      });
      known.add(rule.id);
      continue;
    }

    await createPlatformRecommendationClone(tx, advisorProfileId, rule, slugToPillarId);
    added++;
  }
  return added;
}

async function loadPlatformRecommendationRows(tx: CloneTx) {
  return tx.recommendationRule.findMany({
    where: { isActive: true },
    orderBy: { priority: "desc" },
  });
}

async function createPlatformRecommendationClone(
  tx: CloneTx,
  advisorProfileId: string,
  rule: {
    id: string;
    ruleName: string;
    triggerConditions: unknown;
    serviceRecommendationId: string;
    priority: number;
  },
  slugToPillarId: Map<string, string>,
): Promise<void> {
  const conditions = rule.triggerConditions as { pillarId?: string };
  const pillarSlug = conditions.pillarId;
  const pillarId = pillarSlug ? slugToPillarId.get(pillarSlug) : null;
  await tx.advisorRecommendationRule.create({
    data: {
      advisorProfileId,
      pillarId: pillarId ?? null,
      sourceKind: AdvisorQuestionSource.PLATFORM,
      platformSourceId: rule.id,
      name: rule.ruleName,
      triggerConditions: rule.triggerConditions as Prisma.InputJsonValue,
      servicePayload: {
        serviceRecommendationId: rule.serviceRecommendationId,
        serviceId: rule.serviceRecommendationId,
      },
      priority: rule.priority,
      isActive: true,
    },
  });
}
