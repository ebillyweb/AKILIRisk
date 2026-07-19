import { AdvisorQuestionSource, PillarCategoryKind, Prisma } from "@prisma/client";
import { serviceIdFromRulePayload } from "@/lib/admin/recommendation-rule-ui";
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
import { pillarIdForRecommendationRule } from "@/lib/methodology/infer-recommendation-rule-pillar";
import { PLATFORM_PILLAR_CATALOG } from "@/lib/methodology/pillar-catalog-starter";
import {
  cloneAllEnterpriseMethodologyToAdvisorInTx,
  syncEnterpriseMethodologyToAdvisorInTx,
} from "@/lib/methodology/clone-enterprise-methodology";

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
      const enterpriseId = await resolveEnterpriseIdForAdvisor(tx, advisorProfileId);

      if (enterpriseId) {
        const overrideCount = await tx.advisorPillarOverride.count({
          where: { advisorProfileId },
        });
        if (overrideCount === 0) {
          await cloneAllEnterpriseMethodologyToAdvisorInTx(
            tx,
            advisorProfileId,
            enterpriseId,
          );
        } else if (options?.force) {
          await syncEnterpriseMethodologyToAdvisorInTx(
            tx,
            enterpriseId,
            advisorProfileId,
          );
        }
      } else {
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
        if (assessCount === 0 || options?.force) {
          await syncMissingPlatformAssessmentQuestions(tx, advisorProfileId, slugToPillarId);
        }

        const intakeCount = await tx.advisorIntakeQuestion.count({
          where: { advisorProfileId },
        });
        if (intakeCount === 0 || options?.force) {
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
      }

      const ruleCount = await tx.advisorRecommendationRule.count({
        where: { advisorProfileId },
      });
      if (ruleCount === 0) {
        if (enterpriseId) {
          await cloneAllEnterpriseRecommendationRules(tx, advisorProfileId, enterpriseId, slugToPillarId);
        } else {
          await cloneAllPlatformRecommendationRules(tx, advisorProfileId, slugToPillarId);
        }
      } else if (options?.force) {
        if (enterpriseId) {
          await syncMissingEnterpriseRecommendationRules(tx, advisorProfileId, enterpriseId, slugToPillarId);
        } else {
          await syncMissingPlatformRecommendationRules(tx, advisorProfileId, slugToPillarId);
        }
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

/** Backfill platform base rows added after the advisor's initial clone (idempotent). */
export async function syncAdvisorPlatformContent(
  advisorProfileId: string,
): Promise<{ intakeAdded: number; assessmentAdded: number; rulesAdded: number }> {
  const pillars = await prisma.pillar.findMany({
    where: { archivedAt: null },
    orderBy: { defaultOrder: "asc" },
  });
  if (pillars.length === 0) {
    return { intakeAdded: 0, assessmentAdded: 0, rulesAdded: 0 };
  }

  const slugToPillarId = new Map(pillars.map((p) => [p.slug, p.id]));

  return prisma.$transaction(
    async (tx) => {
      const intakeAdded = await syncMissingPlatformIntakeQuestions(
        tx,
        advisorProfileId,
        slugToPillarId,
      );
      const assessmentAdded = await syncMissingPlatformAssessmentQuestions(
        tx,
        advisorProfileId,
        slugToPillarId,
      );
      const enterpriseId = await resolveEnterpriseIdForAdvisor(tx, advisorProfileId);
      const rulesAdded = enterpriseId
        ? await syncMissingEnterpriseRecommendationRules(tx, advisorProfileId, enterpriseId, slugToPillarId)
        : await syncMissingPlatformRecommendationRules(tx, advisorProfileId, slugToPillarId);
      return { intakeAdded, assessmentAdded, rulesAdded };
    },
    { timeout: 120_000 },
  );
}

type CloneTx = Prisma.TransactionClient;

export async function syncMissingPlatformAssessmentQuestions(
  tx: CloneTx,
  advisorProfileId: string,
  slugToPillarId: Map<string, string>,
): Promise<number> {
  // Include every source kind — enterprise clones may already carry
  // platformSourceId, and the partial unique index is on that pair alone.
  const existing = await tx.advisorPillarQuestion.findMany({
    where: {
      advisorProfileId,
      OR: [
        { platformSourceId: { not: null } },
        { questionNumber: { not: null } },
      ],
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

    const created = await createPlatformAssessmentClone(
      tx,
      advisorProfileId,
      row,
      slugToPillarId,
    );
    if (created) {
      known.add(row.id);
      added++;
    }
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
): Promise<boolean> {
  const riskArea = riskAreaIdForPillarCategory(row.section.category);
  if (!riskArea) return false;
  const pillarId = slugToPillarId.get(riskArea);
  if (!pillarId) return false;

  const already = await tx.advisorPillarQuestion.findFirst({
    where: { advisorProfileId, platformSourceId: row.id },
    select: { id: true },
  });
  if (already) return false;

  const wire = pillarQuestionRowToWire(row);
  try {
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
        answer0: row.answer0,
        answer1: row.answer1,
        answer2: row.answer2,
        answer3: row.answer3,
        whyThisMatters: row.whyThisMatters,
        recommendedActions: row.recommendedActions,
        isVisible: row.isVisible,
        isKeyRiskIndicator: row.isKeyRiskIndicator,
        relatedPillarIds: mapRelatedPillarIds(row.relatedPillarIds, slugToPillarId),
      },
    });
    return true;
  } catch (err) {
    // Concurrent clone/sync on the same advisor (partial unique index).
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return false;
    }
    throw err;
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
      OR: [
        { platformSourceId: { not: null } },
        { questionNumber: { not: null } },
      ],
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

    const created = await createPlatformIntakeClone(
      tx,
      advisorProfileId,
      row,
      slugToPillarId,
    );
    if (created) {
      known.add(row.id);
      added++;
    }
  }
  return added;
}

async function loadPlatformIntakeRows(tx: CloneTx): Promise<PillarQuestionWithHierarchy[]> {
  return (await tx.pillarQuestion.findMany({
    where: {
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
): Promise<boolean> {
  const already = await tx.advisorIntakeQuestion.findFirst({
    where: { advisorProfileId, platformSourceId: row.id },
    select: { id: true },
  });
  if (already) return false;

  try {
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
        answerType: row.answerType,
        answer0: row.answer0,
        answer1: row.answer1,
        answer2: row.answer2,
        answer3: row.answer3,
        relatedPillarIds: mapRelatedPillarIds(row.relatedPillarIds, slugToPillarId),
        recommendedActions: row.recommendedActions,
        isVisible: row.isVisible,
      },
    });
    return true;
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return false;
    }
    throw err;
  }
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
      OR: [{ platformSourceId: { not: null } }, { name: { not: "" } }],
    },
    select: {
      id: true,
      platformSourceId: true,
      name: true,
      pillarId: true,
      triggerConditions: true,
      servicePayload: true,
      sourceKind: true,
    },
  });
  const known = new Set(
    existing.map((r) => r.platformSourceId).filter((id): id is string => id != null),
  );
  const legacyByName = new Map<string, string>(
    existing
      .filter((r) => r.platformSourceId == null)
      .map((r) => [r.name, r.id]),
  );

  let added = 0;
  for (const row of existing) {
    if (row.pillarId != null) continue;
    const serviceRecommendationId = serviceIdFromRulePayload(row.servicePayload);
    const pillarId = pillarIdForRecommendationRule(
      {
        triggerConditions: row.triggerConditions,
        serviceRecommendationId,
        ruleName: row.name,
      },
      slugToPillarId,
    );
    if (pillarId) {
      await tx.advisorRecommendationRule.update({
        where: { id: row.id },
        data: { pillarId },
      });
    }
  }

  const platformRules = await loadPlatformRecommendationRows(tx);
  for (const rule of platformRules) {
    if (known.has(rule.id)) continue;

    const legacyId = legacyByName.get(rule.ruleName);
    if (legacyId) {
      const pillarId = pillarIdForRecommendationRule(
        {
          triggerConditions: rule.triggerConditions,
          serviceRecommendationId: rule.serviceRecommendationId,
          ruleName: rule.ruleName,
        },
        slugToPillarId,
      );
      await tx.advisorRecommendationRule.update({
        where: { id: legacyId },
        data: {
          platformSourceId: rule.id,
          ...(pillarId ? { pillarId } : {}),
        },
      });
      known.add(rule.id);
      continue;
    }

    const created = await createPlatformRecommendationClone(
      tx,
      advisorProfileId,
      rule,
      slugToPillarId,
    );
    if (created) {
      known.add(rule.id);
      added++;
    }
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
): Promise<boolean> {
  const already = await tx.advisorRecommendationRule.findFirst({
    where: { advisorProfileId, platformSourceId: rule.id },
    select: { id: true },
  });
  if (already) return false;

  const pillarId = pillarIdForRecommendationRule(
    {
      triggerConditions: rule.triggerConditions,
      serviceRecommendationId: rule.serviceRecommendationId,
      ruleName: rule.ruleName,
    },
    slugToPillarId,
  );
  try {
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
    return true;
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return false;
    }
    throw err;
  }
}

// --- Enterprise-aware cloning ---

async function resolveEnterpriseIdForAdvisor(
  tx: CloneTx,
  advisorProfileId: string,
): Promise<string | null> {
  const profile = await tx.advisorProfile.findUnique({
    where: { id: advisorProfileId },
    select: { enterpriseId: true, userId: true },
  });
  if (profile?.enterpriseId) return profile.enterpriseId;

  if (!profile?.userId) return null;

  const membership = await tx.enterpriseMembership.findFirst({
    where: { userId: profile.userId, status: "ACTIVE" },
    select: { enterpriseId: true },
  });
  return membership?.enterpriseId ?? null;
}

async function cloneAllEnterpriseRecommendationRules(
  tx: CloneTx,
  advisorProfileId: string,
  enterpriseId: string,
  slugToPillarId: Map<string, string>,
): Promise<void> {
  const entRules = await tx.enterpriseRecommendationRule.findMany({
    where: { enterpriseId, isActive: true },
    orderBy: { priority: "desc" },
  });
  for (const rule of entRules) {
    await createEnterpriseAdvisorClone(tx, advisorProfileId, rule, slugToPillarId);
  }
}

async function syncMissingEnterpriseRecommendationRules(
  tx: CloneTx,
  advisorProfileId: string,
  enterpriseId: string,
  _slugToPillarId: Map<string, string>,
): Promise<number> {
  const existing = await tx.advisorRecommendationRule.findMany({
    where: { advisorProfileId, enterpriseSourceId: { not: null } },
    select: { enterpriseSourceId: true },
  });
  const known = new Set(
    existing.map((r) => r.enterpriseSourceId).filter((id): id is string => id != null),
  );

  const entRules = await tx.enterpriseRecommendationRule.findMany({
    where: { enterpriseId, isActive: true },
    orderBy: { priority: "desc" },
  });

  let added = 0;
  for (const rule of entRules) {
    if (known.has(rule.id)) continue;
    await createEnterpriseAdvisorClone(tx, advisorProfileId, rule, _slugToPillarId);
    added++;
  }
  return added;
}

async function createEnterpriseAdvisorClone(
  tx: CloneTx,
  advisorProfileId: string,
  rule: {
    id: string;
    pillarId: string | null;
    sourceKind: AdvisorQuestionSource;
    platformSourceId: string | null;
    name: string;
    triggerConditions: unknown;
    servicePayload: unknown;
    priority: number;
  },
  _slugToPillarId: Map<string, string>,
): Promise<void> {
  const sourceKind =
    rule.sourceKind === AdvisorQuestionSource.PLATFORM
      ? AdvisorQuestionSource.PLATFORM
      : AdvisorQuestionSource.ENTERPRISE;

  await tx.advisorRecommendationRule.create({
    data: {
      advisorProfileId,
      pillarId: rule.pillarId,
      sourceKind,
      platformSourceId: rule.platformSourceId,
      enterpriseSourceId: rule.id,
      name: rule.name,
      triggerConditions: rule.triggerConditions as Prisma.InputJsonValue,
      servicePayload: rule.servicePayload as Prisma.InputJsonValue,
      priority: rule.priority,
      isActive: true,
    },
  });
}
