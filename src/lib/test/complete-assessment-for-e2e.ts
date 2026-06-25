import "server-only";

import { Prisma, RiskLevel as PrismaRiskLevel } from "@prisma/client";
import { prisma } from "@/lib/db";
import { findUserByEmail } from "@/lib/auth/user-email";
import {
  getActiveApprovalForUser,
  getScoringCustomizationForClient,
} from "@/lib/data/assessment-customization";
import { getVisibleQuestions } from "@/lib/assessment/branching";
import { getPillarAssessmentConfig } from "@/lib/assessment/pillar-config";
import {
  ASSESSMENT_PILLAR_IDS,
  normalizePillarSlug,
  normalizePillarScoreId,
} from "@/lib/assessment/pillar-registry";
import {
  pillarScoresRecordFromRows,
  syncAssessmentCompletionStatus,
} from "@/lib/assessment/assessment-completion";
import {
  calculateCustomizedPillarScore,
  calculatePillarScore,
} from "@/lib/assessment/scoring";
import {
  getEmphasisMultipliers,
} from "@/lib/assessment/customization";
import { getActiveRiskThresholds } from "@/lib/assessment/risk-thresholds";
import { encryptAnswer } from "@/lib/data/response-content";
import { RecommendationEngine } from "@/lib/assessment/engines/recommendation-engine";

function mapRiskLevelToPrisma(riskLevel: string): PrismaRiskLevel {
  switch (riskLevel) {
    case "low":
      return "LOW";
    case "medium":
      return "MEDIUM";
    case "high":
      return "HIGH";
    case "critical":
      return "CRITICAL";
    default:
      return "MEDIUM";
  }
}

export type CompleteAssessmentForE2EOptions = {
  clientEmail: string;
  /** Remove reports, responses, and pillar scores on the target assessment before scoring. */
  reset?: boolean;
  /** When false, only reset (if reset=true) without scoring pillars. Default true. */
  complete?: boolean;
  /** Maturity answer value (0–3) for answered questions. Default 2 (Formalized). */
  maturityAnswer?: number;
};

export type CompleteAssessmentForE2EResult = {
  userId: string;
  clientId: string;
  assessmentId: string;
  status: string;
  draftReportId: string | null;
  pillarsScored: string[];
};

/**
 * Test-only helper: answer ≥50% of visible questions per pillar and score all six.
 * Used by POST /api/test/assessment/prepare (Epic 5.2 Playwright).
 */
export async function completeAssessmentForE2E(
  options: CompleteAssessmentForE2EOptions
): Promise<CompleteAssessmentForE2EResult> {
  const email = options.clientEmail.trim().toLowerCase();
  const maturityAnswer = options.maturityAnswer ?? 2;
  const shouldComplete = options.complete !== false;

  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error(`User not found: ${email}`);
  }

  const approval = await getActiveApprovalForUser(user.id);

  let assessment = await prisma.assessment.findFirst({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, approvalId: true, status: true },
  });

  if (!assessment) {
    assessment = await prisma.assessment.create({
      data: {
        userId: user.id,
        version: 1,
        status: "IN_PROGRESS",
        approvalId: approval?.id ?? null,
      },
      select: { id: true, approvalId: true, status: true },
    });
  }

  if (options.reset) {
    await prisma.report.deleteMany({ where: { assessmentId: assessment.id } });
    await prisma.assessmentRecommendation.deleteMany({
      where: { assessmentId: assessment.id },
    });
    await prisma.pillarScore.deleteMany({ where: { assessmentId: assessment.id } });
    await prisma.assessmentResponse.deleteMany({
      where: { assessmentId: assessment.id },
    });
    await prisma.assessment.update({
      where: { id: assessment.id },
      data: {
        status: "IN_PROGRESS",
        completedAt: null,
        currentPillar: null,
        currentQuestionIndex: null,
      },
    });
  }

  const activeThresholds = await getActiveRiskThresholds();

  const customizationConfig = await getScoringCustomizationForClient(user.id);
  const emphasisMultipliers = customizationConfig
    ? getEmphasisMultipliers(customizationConfig)
    : null;

  const pillarsScored: string[] = [];

  if (!shouldComplete) {
    const updated = await prisma.assessment.findUnique({
      where: { id: assessment.id },
      select: { status: true },
    });
    return {
      userId: user.id,
      clientId: user.id,
      assessmentId: assessment.id,
      status: updated?.status ?? "IN_PROGRESS",
      draftReportId: null,
      pillarsScored,
    };
  }

  for (const pillarId of ASSESSMENT_PILLAR_IDS) {
    const pillar = normalizePillarSlug(pillarId);
    const pillarConfig = await getPillarAssessmentConfig(pillar);
    if (!pillarConfig || pillarConfig.questions.length === 0) {
      continue;
    }

    const answers: Record<string, unknown> = {};
    let visibleQuestions = getVisibleQuestions(answers, pillarConfig.questions);

    // Answer visible questions in passes until ≥50% of final visible set is answered.
    for (let pass = 0; pass < 8; pass++) {
      visibleQuestions = getVisibleQuestions(answers, pillarConfig.questions);
      const targetCount = Math.max(
        1,
        Math.ceil(visibleQuestions.length * 0.5)
      );
      let answeredVisible = visibleQuestions.filter(
        (q) => answers[q.id] !== undefined && answers[q.id] !== null
      ).length;

      if (answeredVisible >= targetCount) {
        break;
      }

      for (const q of visibleQuestions) {
        if (answers[q.id] !== undefined && answers[q.id] !== null) continue;
        answers[q.id] = maturityAnswer;
        answeredVisible++;
        if (answeredVisible >= targetCount) break;
      }
    }

    const visibleIds = getVisibleQuestions(answers, pillarConfig.questions).map(
      (q) => q.id
    );

    for (const q of pillarConfig.questions) {
      if (answers[q.id] === undefined) continue;
      const encrypted = encryptAnswer(answers[q.id]);
      await prisma.assessmentResponse.upsert({
        where: {
          assessmentId_questionId: {
            assessmentId: assessment.id,
            questionId: q.id,
          },
        },
        create: {
          assessmentId: assessment.id,
          questionId: q.id,
          pillar: q.subCategory ?? pillar,
          subCategory: q.subCategory ?? pillar,
          answer: encrypted,
          skipped: false,
        },
        update: {
          answer: encrypted,
          skipped: false,
        },
      });
    }

    const hasEmphasis =
      emphasisMultipliers != null && (emphasisMultipliers[pillar] ?? 1) > 1;

    const scoreResult = hasEmphasis
      ? calculateCustomizedPillarScore(
          answers,
          pillarConfig.pillarData,
          pillarConfig.questions,
          visibleIds,
          emphasisMultipliers!,
          activeThresholds
        )
      : calculatePillarScore(
          answers,
          pillarConfig.pillarData,
          pillarConfig.questions,
          visibleIds,
          activeThresholds
        );

    const prismaRiskLevel = mapRiskLevelToPrisma(scoreResult.riskLevel);

    await prisma.$transaction(async (tx) => {
      await tx.pillarScore.upsert({
        where: {
          assessmentId_pillar: { assessmentId: assessment!.id, pillar },
        },
        create: {
          assessmentId: assessment!.id,
          pillar,
          score: scoreResult.score,
          riskLevel: prismaRiskLevel,
          breakdown: scoreResult.breakdown as unknown as Prisma.InputJsonValue,
          missingControls:
            scoreResult.missingControls as unknown as Prisma.InputJsonValue,
        },
        update: {
          score: scoreResult.score,
          riskLevel: prismaRiskLevel,
          breakdown: scoreResult.breakdown as unknown as Prisma.InputJsonValue,
          missingControls:
            scoreResult.missingControls as unknown as Prisma.InputJsonValue,
          calculatedAt: new Date(),
        },
      });

      const allScores = await tx.pillarScore.findMany({
        where: { assessmentId: assessment!.id },
        select: { pillar: true, score: true, riskLevel: true },
      });

      const pillarScoresMap = pillarScoresRecordFromRows(
        allScores.map((row) => ({
          pillar: normalizePillarScoreId(row.pillar),
          score: row.score,
          riskLevel: row.riskLevel,
        }))
      );

      const recommendationEngine = new RecommendationEngine();
      const matchedRecommendations =
        await recommendationEngine.matchAndDedupeRecommendations({
          assessmentId: assessment!.id,
          userId: user.id,
          pillarScores: pillarScoresMap,
          answers,
          householdProfile: null,
          missingControls: scoreResult.missingControls,
        });

      await tx.assessmentRecommendation.deleteMany({
        where: { assessmentId: assessment!.id },
      });

      if (matchedRecommendations.length > 0) {
        await tx.assessmentRecommendation.createMany({
          data: matchedRecommendations.slice(0, 10).map((rec, index) => ({
            assessmentId: assessment!.id,
            serviceRecommendationId: rec.id,
            triggerReason: {
              reasons: rec.triggerReason,
            } as unknown as Prisma.InputJsonValue,
            customization: (rec.customization ??
              undefined) as unknown as Prisma.InputJsonValue | undefined,
            priority: index + 1,
            status: "PENDING",
          })),
        });
      }

      await syncAssessmentCompletionStatus(tx, assessment!.id);
    });

    pillarsScored.push(pillar);
  }

  const updated = await prisma.assessment.findUnique({
    where: { id: assessment.id },
    select: { status: true },
  });

  const existingDraft = await prisma.report.findFirst({
    where: { assessmentId: assessment.id, status: "DRAFT" },
    select: { id: true },
  });

  let draftReportId = existingDraft?.id ?? null;
  if (!draftReportId) {
    const latest = await prisma.report.findFirst({
      where: { assessmentId: assessment.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const created = await prisma.report.create({
      data: {
        assessmentId: assessment.id,
        version: (latest?.version ?? 0) + 1,
        status: "DRAFT",
        templateChoice: "COBRANDED",
      },
      select: { id: true },
    });
    draftReportId = created.id;
  }

  return {
    userId: user.id,
    clientId: user.id,
    assessmentId: assessment.id,
    status: updated?.status ?? "IN_PROGRESS",
    draftReportId,
    pillarsScored,
  };
}
