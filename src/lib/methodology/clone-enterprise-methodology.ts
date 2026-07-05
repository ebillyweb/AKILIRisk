import "server-only";

import { AdvisorQuestionSource, PillarCategoryKind, Prisma } from "@prisma/client";

import { DEFAULT_RISK_THRESHOLDS } from "@/lib/assessment/governance-rubric";
import {
  pillarQuestionInclude,
  pillarQuestionRowToWire,
  sortPillarQuestionRows,
  type PillarQuestionWithHierarchy,
} from "@/lib/assessment/bank/pillar-question-wire";
import { riskAreaIdForPillarCategory } from "@/lib/assessment/bank/pillar-category-risk-area";
import { prisma } from "@/lib/db";
import { narrativeStarterForSlug } from "@/lib/methodology/narrative-starter";
import { PLATFORM_PILLAR_CATALOG } from "@/lib/methodology/pillar-catalog-starter";

type MethodologyTx = Prisma.TransactionClient;

export async function enterpriseHasMethodologyContent(
  tx: MethodologyTx,
  enterpriseId: string,
): Promise<boolean> {
  const [overrides, assess, intake, narratives] = await Promise.all([
    tx.enterprisePillarOverride.count({ where: { enterpriseId } }),
    tx.enterprisePillarQuestion.count({ where: { enterpriseId } }),
    tx.enterpriseIntakeQuestion.count({ where: { enterpriseId } }),
    tx.enterprisePillarNarrative.count({ where: { enterpriseId } }),
  ]);
  return overrides + assess + intake + narratives > 0;
}

/**
 * Seed firm methodology from platform defaults when the enterprise has none yet.
 */
export async function ensureEnterprisePlatformMethodologyInTx(
  tx: MethodologyTx,
  enterpriseId: string,
): Promise<boolean> {
  if (await enterpriseHasMethodologyContent(tx, enterpriseId)) return false;

  const pillars = await tx.pillar.findMany({
    where: { archivedAt: null },
    orderBy: { defaultOrder: "asc" },
  });
  if (pillars.length === 0) return false;

  const slugToPillarId = new Map(pillars.map((p) => [p.slug, p.id]));

  for (const pillar of pillars) {
    const starter = PLATFORM_PILLAR_CATALOG.find((p) => p.slug === pillar.slug);
    const weight = starter?.defaultWeight ?? 10;
    await tx.enterprisePillarOverride.create({
      data: {
        enterpriseId,
        pillarId: pillar.id,
        isActive: true,
        weight,
        threshold: DEFAULT_RISK_THRESHOLDS as unknown as Prisma.InputJsonValue,
        emphasisMultiplier: 1.5,
        displayOrder: pillar.defaultOrder,
      },
    });
  }

  const assessRows = await loadPlatformAssessmentRows(tx);
  for (const row of sortPillarQuestionRows(assessRows)) {
    await createEnterprisePlatformAssessmentClone(tx, enterpriseId, row, slugToPillarId);
  }

  const intakeRows = await loadPlatformIntakeRows(tx);
  for (const row of sortPillarQuestionRows(intakeRows)) {
    await createEnterprisePlatformIntakeClone(tx, enterpriseId, row, slugToPillarId);
  }

  for (const pillar of pillars) {
    const bands = narrativeStarterForSlug(pillar.slug);
    await tx.enterprisePillarNarrative.create({
      data: {
        enterpriseId,
        pillarId: pillar.id,
        allNegative: bands.allNegative,
        allYes: bands.allYes,
        midBand: bands.midBand,
      },
    });
  }

  return true;
}

/**
 * Promote a solo advisor's methodology rows into the enterprise tables (first entry).
 */
export async function transferAdvisorMethodologyToEnterpriseInTx(
  tx: MethodologyTx,
  advisorProfileId: string,
  enterpriseId: string,
): Promise<number> {
  const hasContent = await enterpriseHasMethodologyContent(tx, enterpriseId);
  if (hasContent) {
    return mergeAdvisorMethodologyIntoEnterpriseInTx(tx, advisorProfileId, enterpriseId);
  }

  let transferred = 0;

  const overrides = await tx.advisorPillarOverride.findMany({
    where: { advisorProfileId },
  });
  for (const row of overrides) {
    const ent = await tx.enterprisePillarOverride.create({
      data: {
        enterpriseId,
        pillarId: row.pillarId,
        isActive: row.isActive,
        displayName: row.displayName,
        weight: row.weight,
        threshold: row.threshold as Prisma.InputJsonValue,
        sectionWeights: row.sectionWeights as Prisma.InputJsonValue | undefined,
        emphasisMultiplier: row.emphasisMultiplier,
        displayOrder: row.displayOrder,
      },
    });
    await tx.advisorPillarOverride.update({
      where: { id: row.id },
      data: { enterpriseSourceId: ent.id, version: { increment: 1 } },
    });
    transferred++;
  }

  const narratives = await tx.advisorPillarNarrative.findMany({
    where: { advisorProfileId },
  });
  for (const row of narratives) {
    const ent = await tx.enterprisePillarNarrative.create({
      data: {
        enterpriseId,
        pillarId: row.pillarId,
        allNegative: row.allNegative as Prisma.InputJsonValue,
        allYes: row.allYes as Prisma.InputJsonValue,
        midBand: row.midBand as Prisma.InputJsonValue,
      },
    });
    await tx.advisorPillarNarrative.update({
      where: { id: row.id },
      data: { enterpriseSourceId: ent.id, version: { increment: 1 } },
    });
    transferred++;
  }

  const assessQuestions = await tx.advisorPillarQuestion.findMany({
    where: { advisorProfileId },
    orderBy: { displayOrder: "asc" },
  });
  for (const row of assessQuestions) {
    const ent = await tx.enterprisePillarQuestion.create({
      data: {
        enterpriseId,
        pillarId: row.pillarId,
        sourceKind:
          row.sourceKind === AdvisorQuestionSource.CUSTOM
            ? AdvisorQuestionSource.CUSTOM
            : AdvisorQuestionSource.PLATFORM,
        platformSourceId: row.platformSourceId,
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
        relatedPillarIds: row.relatedPillarIds,
      },
    });
    await tx.advisorPillarQuestion.update({
      where: { id: row.id },
      data: {
        enterpriseSourceId: ent.id,
        sourceKind:
          row.sourceKind === AdvisorQuestionSource.CUSTOM
            ? AdvisorQuestionSource.ENTERPRISE
            : row.sourceKind,
        version: { increment: 1 },
      },
    });
    transferred++;
  }

  const intakeQuestions = await tx.advisorIntakeQuestion.findMany({
    where: { advisorProfileId },
    orderBy: { displayOrder: "asc" },
  });
  for (const row of intakeQuestions) {
    const ent = await tx.enterpriseIntakeQuestion.create({
      data: {
        enterpriseId,
        sourceKind:
          row.sourceKind === AdvisorQuestionSource.CUSTOM
            ? AdvisorQuestionSource.CUSTOM
            : AdvisorQuestionSource.PLATFORM,
        platformSourceId: row.platformSourceId,
        displayOrder: row.displayOrder,
        questionNumber: row.questionNumber,
        questionText: row.questionText,
        context: row.context,
        helpText: row.helpText,
        learnMore: row.learnMore,
        answerType: row.answerType,
        options: row.options as Prisma.InputJsonValue | undefined,
        relatedPillarIds: row.relatedPillarIds,
        recommendedActions: row.recommendedActions,
        isVisible: row.isVisible,
      },
    });
    await tx.advisorIntakeQuestion.update({
      where: { id: row.id },
      data: {
        enterpriseSourceId: ent.id,
        sourceKind:
          row.sourceKind === AdvisorQuestionSource.CUSTOM
            ? AdvisorQuestionSource.ENTERPRISE
            : row.sourceKind,
        version: { increment: 1 },
      },
    });
    transferred++;
  }

  if (transferred === 0) {
    await ensureEnterprisePlatformMethodologyInTx(tx, enterpriseId);
    await linkAdvisorMethodologyToEnterpriseInTx(tx, advisorProfileId, enterpriseId);
  }

  return transferred;
}

async function mergeAdvisorMethodologyIntoEnterpriseInTx(
  tx: MethodologyTx,
  advisorProfileId: string,
  enterpriseId: string,
): Promise<number> {
  let merged = 0;

  const customAssess = await tx.advisorPillarQuestion.findMany({
    where: { advisorProfileId, sourceKind: AdvisorQuestionSource.CUSTOM },
  });
  for (const row of customAssess) {
    const duplicate = await tx.enterprisePillarQuestion.findFirst({
      where: {
        enterpriseId,
        sourceKind: AdvisorQuestionSource.CUSTOM,
        pillarId: row.pillarId,
        questionText: row.questionText,
      },
    });
    if (duplicate) {
      await tx.advisorPillarQuestion.update({
        where: { id: row.id },
        data: {
          enterpriseSourceId: duplicate.id,
          sourceKind: AdvisorQuestionSource.ENTERPRISE,
          version: { increment: 1 },
        },
      });
      continue;
    }

    const ent = await tx.enterprisePillarQuestion.create({
      data: {
        enterpriseId,
        pillarId: row.pillarId,
        sourceKind: AdvisorQuestionSource.CUSTOM,
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
        relatedPillarIds: row.relatedPillarIds,
      },
    });
    await tx.advisorPillarQuestion.update({
      where: { id: row.id },
      data: {
        enterpriseSourceId: ent.id,
        sourceKind: AdvisorQuestionSource.ENTERPRISE,
        version: { increment: 1 },
      },
    });
    merged++;
  }

  const customIntake = await tx.advisorIntakeQuestion.findMany({
    where: { advisorProfileId, sourceKind: AdvisorQuestionSource.CUSTOM },
  });
  for (const row of customIntake) {
    const duplicate = await tx.enterpriseIntakeQuestion.findFirst({
      where: {
        enterpriseId,
        sourceKind: AdvisorQuestionSource.CUSTOM,
        questionText: row.questionText,
      },
    });
    if (duplicate) {
      await tx.advisorIntakeQuestion.update({
        where: { id: row.id },
        data: {
          enterpriseSourceId: duplicate.id,
          sourceKind: AdvisorQuestionSource.ENTERPRISE,
          version: { increment: 1 },
        },
      });
      continue;
    }

    const ent = await tx.enterpriseIntakeQuestion.create({
      data: {
        enterpriseId,
        sourceKind: AdvisorQuestionSource.CUSTOM,
        displayOrder: row.displayOrder,
        questionNumber: row.questionNumber,
        questionText: row.questionText,
        context: row.context,
        helpText: row.helpText,
        learnMore: row.learnMore,
        answerType: row.answerType,
        options: row.options as Prisma.InputJsonValue | undefined,
        relatedPillarIds: row.relatedPillarIds,
        recommendedActions: row.recommendedActions,
        isVisible: row.isVisible,
      },
    });
    await tx.advisorIntakeQuestion.update({
      where: { id: row.id },
      data: {
        enterpriseSourceId: ent.id,
        sourceKind: AdvisorQuestionSource.ENTERPRISE,
        version: { increment: 1 },
      },
    });
    merged++;
  }

  await linkAdvisorMethodologyToEnterpriseInTx(tx, advisorProfileId, enterpriseId);
  return merged;
}

async function linkAdvisorMethodologyToEnterpriseInTx(
  tx: MethodologyTx,
  advisorProfileId: string,
  enterpriseId: string,
): Promise<void> {
  const profile = await tx.advisorProfile.findUnique({
    where: { id: advisorProfileId },
    select: { enterpriseId: true },
  });
  if (profile?.enterpriseId !== enterpriseId) return;

  const [entOverrides, entNarratives, entAssess, entIntake] = await Promise.all([
    tx.enterprisePillarOverride.findMany({ where: { enterpriseId } }),
    tx.enterprisePillarNarrative.findMany({ where: { enterpriseId } }),
    tx.enterprisePillarQuestion.findMany({ where: { enterpriseId } }),
    tx.enterpriseIntakeQuestion.findMany({ where: { enterpriseId } }),
  ]);

  for (const ent of entOverrides) {
    await tx.advisorPillarOverride.updateMany({
      where: {
        advisorProfileId,
        pillarId: ent.pillarId,
        enterpriseSourceId: null,
      },
      data: { enterpriseSourceId: ent.id },
    });
  }

  for (const ent of entNarratives) {
    await tx.advisorPillarNarrative.updateMany({
      where: {
        advisorProfileId,
        pillarId: ent.pillarId,
        enterpriseSourceId: null,
      },
      data: { enterpriseSourceId: ent.id },
    });
  }

  const entAssessByPlatform = new Map(
    entAssess
      .filter((q) => q.platformSourceId)
      .map((q) => [q.platformSourceId!, q.id]),
  );
  for (const ent of entAssess) {
    await tx.advisorPillarQuestion.updateMany({
      where: {
        advisorProfileId,
        pillarId: ent.pillarId,
        enterpriseSourceId: null,
        ...(ent.platformSourceId
          ? { platformSourceId: ent.platformSourceId }
          : ent.sourceKind === AdvisorQuestionSource.CUSTOM
            ? { sourceKind: AdvisorQuestionSource.CUSTOM, questionText: ent.questionText }
            : {}),
      },
      data: {
        enterpriseSourceId: ent.id,
        ...(ent.sourceKind === AdvisorQuestionSource.CUSTOM
          ? { sourceKind: AdvisorQuestionSource.ENTERPRISE }
          : {}),
      },
    });
  }
  void entAssessByPlatform;

  const entIntakeByPlatform = new Map(
    entIntake.filter((q) => q.platformSourceId).map((q) => [q.platformSourceId!, q.id]),
  );
  for (const ent of entIntake) {
    await tx.advisorIntakeQuestion.updateMany({
      where: {
        advisorProfileId,
        enterpriseSourceId: null,
        ...(ent.platformSourceId
          ? { platformSourceId: ent.platformSourceId }
          : ent.sourceKind === AdvisorQuestionSource.CUSTOM
            ? { sourceKind: AdvisorQuestionSource.CUSTOM, questionText: ent.questionText }
            : {}),
      },
      data: {
        enterpriseSourceId: ent.id,
        ...(ent.sourceKind === AdvisorQuestionSource.CUSTOM
          ? { sourceKind: AdvisorQuestionSource.ENTERPRISE }
          : {}),
      },
    });
  }
  void entIntakeByPlatform;
}

export async function syncEnterpriseMethodologyToMembers(
  enterpriseId: string,
): Promise<{ advisorsUpdated: number }> {
  const members = await prisma.enterpriseMembership.findMany({
    where: { enterpriseId, status: "ACTIVE", advisorProfileId: { not: null } },
    select: { advisorProfileId: true },
  });

  let advisorsUpdated = 0;
  for (const member of members) {
    if (!member.advisorProfileId) continue;
    const changed = await syncEnterpriseMethodologyToAdvisor(
      enterpriseId,
      member.advisorProfileId,
    );
    if (changed) advisorsUpdated++;
  }

  return { advisorsUpdated };
}

export async function syncEnterpriseMethodologyToAdvisor(
  enterpriseId: string,
  advisorProfileId: string,
): Promise<boolean> {
  return prisma.$transaction(
    (tx) => syncEnterpriseMethodologyToAdvisorInTx(tx, enterpriseId, advisorProfileId),
    { timeout: 120_000 },
  );
}

export async function syncEnterpriseMethodologyToAdvisorInTx(
  tx: MethodologyTx,
  enterpriseId: string,
  advisorProfileId: string,
): Promise<boolean> {
  let changed = false;

  const enterprise = await tx.advisorEnterprise.findUnique({
    where: { id: enterpriseId },
    select: { intakeQuestionBankMode: true },
  });
  if (enterprise) {
    const profile = await tx.advisorProfile.findUnique({
      where: { id: advisorProfileId },
      select: { intakeQuestionBankMode: true },
    });
    if (profile?.intakeQuestionBankMode !== enterprise.intakeQuestionBankMode) {
      await tx.advisorProfile.update({
        where: { id: advisorProfileId },
        data: { intakeQuestionBankMode: enterprise.intakeQuestionBankMode },
      });
      changed = true;
    }
  }

    const entOverrides = await tx.enterprisePillarOverride.findMany({
      where: { enterpriseId },
    });
    for (const ent of entOverrides) {
      const existing = await tx.advisorPillarOverride.findUnique({
        where: {
          advisorProfileId_pillarId: {
            advisorProfileId,
            pillarId: ent.pillarId,
          },
        },
      });
      if (existing?.enterpriseSourceId === ent.id) {
        await tx.advisorPillarOverride.update({
          where: { id: existing.id },
          data: {
            isActive: ent.isActive,
            displayName: ent.displayName,
            weight: ent.weight,
            threshold: ent.threshold as Prisma.InputJsonValue,
            sectionWeights: ent.sectionWeights as Prisma.InputJsonValue | undefined,
            emphasisMultiplier: ent.emphasisMultiplier,
            displayOrder: ent.displayOrder,
            version: { increment: 1 },
          },
        });
        changed = true;
        continue;
      }
      if (existing && !existing.enterpriseSourceId) {
        await tx.advisorPillarOverride.update({
          where: { id: existing.id },
          data: {
            enterpriseSourceId: ent.id,
            isActive: ent.isActive,
            displayName: ent.displayName,
            weight: ent.weight,
            threshold: ent.threshold as Prisma.InputJsonValue,
            sectionWeights: ent.sectionWeights as Prisma.InputJsonValue | undefined,
            emphasisMultiplier: ent.emphasisMultiplier,
            displayOrder: ent.displayOrder,
            version: { increment: 1 },
          },
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

    const entNarratives = await tx.enterprisePillarNarrative.findMany({
      where: { enterpriseId },
    });
    for (const ent of entNarratives) {
      await tx.advisorPillarNarrative.upsert({
        where: {
          advisorProfileId_pillarId: {
            advisorProfileId,
            pillarId: ent.pillarId,
          },
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

    const entAssess = await tx.enterprisePillarQuestion.findMany({
      where: { enterpriseId },
    });
    const advisorAssess = await tx.advisorPillarQuestion.findMany({
      where: { advisorProfileId },
      select: { id: true, enterpriseSourceId: true, platformSourceId: true },
    });
    const advisorByEntSource = new Map(
      advisorAssess
        .filter((q) => q.enterpriseSourceId)
        .map((q) => [q.enterpriseSourceId!, q.id]),
    );

    for (const ent of entAssess) {
      const existingId = advisorByEntSource.get(ent.id);
      if (existingId) {
        await tx.advisorPillarQuestion.update({
          where: { id: existingId },
          data: buildAdvisorAssessmentCloneUpdate(ent),
        });
        changed = true;
        continue;
      }

      await tx.advisorPillarQuestion.create({
        data: buildAdvisorAssessmentCloneCreate(advisorProfileId, ent),
      });
      changed = true;
    }

    const entIntake = await tx.enterpriseIntakeQuestion.findMany({
      where: { enterpriseId },
    });
    const advisorIntake = await tx.advisorIntakeQuestion.findMany({
      where: { advisorProfileId },
      select: { id: true, enterpriseSourceId: true },
    });
    const advisorIntakeByEnt = new Map(
      advisorIntake
        .filter((q) => q.enterpriseSourceId)
        .map((q) => [q.enterpriseSourceId!, q.id]),
    );

    for (const ent of entIntake) {
      const existingId = advisorIntakeByEnt.get(ent.id);
      if (existingId) {
        await tx.advisorIntakeQuestion.update({
          where: { id: existingId },
          data: buildAdvisorIntakeCloneUpdate(ent),
        });
        changed = true;
        continue;
      }

      await tx.advisorIntakeQuestion.create({
        data: buildAdvisorIntakeCloneCreate(advisorProfileId, ent),
      });
      changed = true;
    }

    return changed;
}

function advisorQuestionSourceFromEnterprise(
  sourceKind: AdvisorQuestionSource,
): AdvisorQuestionSource {
  return sourceKind === AdvisorQuestionSource.CUSTOM
    ? AdvisorQuestionSource.ENTERPRISE
    : AdvisorQuestionSource.PLATFORM;
}

function buildAdvisorAssessmentCloneCreate(
  advisorProfileId: string,
  ent: {
    id: string;
    pillarId: string;
    sourceKind: AdvisorQuestionSource;
    platformSourceId: string | null;
    sectionCode: string;
    displayOrder: number;
    questionNumber: string | null;
    questionText: string;
    answerType: string;
    scoreMap: unknown;
    answer0: string | null;
    answer1: string | null;
    answer2: string | null;
    answer3: string | null;
    whyThisMatters: string | null;
    recommendedActions: string | null;
    isVisible: boolean;
    isKeyRiskIndicator: boolean;
    relatedPillarIds: string[];
  },
): Prisma.AdvisorPillarQuestionCreateInput {
  return {
    advisorProfile: { connect: { id: advisorProfileId } },
    pillar: { connect: { id: ent.pillarId } },
    enterpriseSource: { connect: { id: ent.id } },
    sourceKind: advisorQuestionSourceFromEnterprise(ent.sourceKind),
    platformSource: ent.platformSourceId
      ? { connect: { id: ent.platformSourceId } }
      : undefined,
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
  };
}

function buildAdvisorAssessmentCloneUpdate(ent: {
  questionText: string;
  whyThisMatters: string | null;
  recommendedActions: string | null;
  isVisible: boolean;
  displayOrder: number;
  answerType: string;
  scoreMap: unknown;
  answer0: string | null;
  answer1: string | null;
  answer2: string | null;
  answer3: string | null;
}): Prisma.AdvisorPillarQuestionUpdateInput {
  return {
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
  };
}

function buildAdvisorIntakeCloneCreate(
  advisorProfileId: string,
  ent: {
    id: string;
    sourceKind: AdvisorQuestionSource;
    platformSourceId: string | null;
    displayOrder: number;
    questionNumber: string | null;
    questionText: string;
    context: string | null;
    helpText: string | null;
    learnMore: string | null;
    answerType: string;
    answer0: string | null;
    answer1: string | null;
    answer2: string | null;
    answer3: string | null;
    options: unknown;
    relatedPillarIds: string[];
    recommendedActions: string | null;
    isVisible: boolean;
  },
): Prisma.AdvisorIntakeQuestionCreateInput {
  return {
    advisorProfile: { connect: { id: advisorProfileId } },
    enterpriseSource: { connect: { id: ent.id } },
    sourceKind: advisorQuestionSourceFromEnterprise(ent.sourceKind),
    platformSource: ent.platformSourceId
      ? { connect: { id: ent.platformSourceId } }
      : undefined,
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
  };
}

function buildAdvisorIntakeCloneUpdate(ent: {
  questionText: string;
  context: string | null;
  helpText: string | null;
  learnMore: string | null;
  isVisible: boolean;
  displayOrder: number;
  answerType: string;
  answer0: string | null;
  answer1: string | null;
  answer2: string | null;
  answer3: string | null;
}): Prisma.AdvisorIntakeQuestionUpdateInput {
  return {
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
    version: { increment: 1 },
  };
}

export async function cloneAllEnterpriseMethodologyToAdvisorInTx(
  tx: MethodologyTx,
  advisorProfileId: string,
  enterpriseId: string,
): Promise<void> {
  await ensureEnterprisePlatformMethodologyInTx(tx, enterpriseId);
  await syncEnterpriseMethodologyToAdvisorInTx(tx, enterpriseId, advisorProfileId);
}

async function loadPlatformAssessmentRows(tx: MethodologyTx): Promise<PillarQuestionWithHierarchy[]> {
  return (await tx.pillarQuestion.findMany({
    where: {
      isVisible: true,
      section: { category: { kind: PillarCategoryKind.ASSESSMENT } },
    },
    include: pillarQuestionInclude,
  })) as PillarQuestionWithHierarchy[];
}

async function loadPlatformIntakeRows(tx: MethodologyTx): Promise<PillarQuestionWithHierarchy[]> {
  return (await tx.pillarQuestion.findMany({
    where: {
      section: { category: { kind: PillarCategoryKind.INTAKE } },
    },
    include: pillarQuestionInclude,
  })) as PillarQuestionWithHierarchy[];
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

async function createEnterprisePlatformAssessmentClone(
  tx: MethodologyTx,
  enterpriseId: string,
  row: PillarQuestionWithHierarchy,
  slugToPillarId: Map<string, string>,
): Promise<void> {
  const riskArea = riskAreaIdForPillarCategory(row.section.category);
  if (!riskArea) return;
  const pillarId = slugToPillarId.get(riskArea);
  if (!pillarId) return;
  const wire = pillarQuestionRowToWire(row);
  await tx.enterprisePillarQuestion.create({
    data: {
      enterpriseId,
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
}

async function createEnterprisePlatformIntakeClone(
  tx: MethodologyTx,
  enterpriseId: string,
  row: PillarQuestionWithHierarchy,
  slugToPillarId: Map<string, string>,
): Promise<void> {
  await tx.enterpriseIntakeQuestion.create({
    data: {
      enterpriseId,
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
}
