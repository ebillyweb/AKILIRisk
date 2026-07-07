import "server-only";

import type { Prisma, UserRole } from "@prisma/client";
import { Prisma as PrismaNs, RiskLevel as PrismaRiskLevel } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logSafeError, safeErrorMessage } from "@/lib/log-safe-error";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import { calculatePillarScore, calculateCustomizedPillarScore } from "@/lib/assessment/scoring";
import { getVisibleQuestions } from "@/lib/assessment/branching";
import { calculateIdentityRiskScore } from "@/lib/identity-risk/scoring";
import { getEmphasisMultipliers } from "@/lib/assessment/customization";
import { getScoringCustomizationForClient } from "@/lib/data/assessment-customization";
import { safeDecryptAnswer } from "@/lib/data/response-content";
import { assessmentNeedsRescore } from "@/lib/assessment/answers-changed-after-complete";
import type { MissingControl } from "@/lib/assessment/types";
import { RecommendationEngine } from "@/lib/assessment/engines/recommendation-engine";
import {
  resolvePillarConfigForAssessment,
  resolveRecommendationRulesForAssessment,
  resolveThresholdsForAssessmentPillar,
} from "@/lib/methodology/assessment-runtime";

export type RescoreActor = {
  userId: string;
  email: string | null;
  role: UserRole;
};

export type RescoreAssessmentResult = {
  assessmentId: string;
  newVersion: number;
  rescoredAt: Date;
  pillarsChanged: number;
  recommendationsCount: number;
};

export type RescoreActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

function ok<T>(data: T): RescoreActionResult<T> {
  return { success: true, data };
}

function fail(error: string): RescoreActionResult<never> {
  return { success: false, error };
}

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

export async function executeAssessmentRescore(input: {
  assessmentId: string;
  reason?: string;
  actor: RescoreActor;
  requireStaleScores?: boolean;
}): Promise<RescoreActionResult<RescoreAssessmentResult>> {
  const requireStaleScores = input.requireStaleScores ?? true;
  let beforeSnapshot: { pillarScores: unknown[]; recommendations: unknown[] } | null = null;
  let afterSnapshot: { pillarScores: unknown[]; recommendations: unknown[] } | null = null;
  let succeeded = false;

  try {
    const assessment = await prisma.assessment.findUnique({
      where: { id: input.assessmentId },
      select: {
        id: true,
        userId: true,
        version: true,
        status: true,
        answersChangedAfterCompleteAt: true,
        scores: { orderBy: { calculatedAt: "asc" } },
        recommendations: true,
      },
    });
    if (!assessment) return fail("Assessment not found");

    if (
      requireStaleScores &&
      !assessmentNeedsRescore({
        status: assessment.status,
        answersChangedAfterCompleteAt: assessment.answersChangedAfterCompleteAt,
      })
    ) {
      return fail(
        "Re-score is only available when a client changed answers after the assessment was marked complete.",
      );
    }

    if (assessment.scores.length === 0) {
      return fail(
        "Assessment has no existing pillar scores to rescore — score the assessment normally first.",
      );
    }

    beforeSnapshot = {
      pillarScores: assessment.scores,
      recommendations: assessment.recommendations,
    };

    const responses = await prisma.assessmentResponse.findMany({
      where: { assessmentId: input.assessmentId, skipped: false },
      select: { questionId: true, answer: true, pillar: true },
    });
    const allAnswers: Record<string, unknown> = {};
    for (const r of responses) {
      allAnswers[r.questionId] = safeDecryptAnswer(
        r.answer as unknown as string | null,
        { rowId: r.questionId, column: "AssessmentResponse.answer" },
      );
    }

    const rulesOverride = await resolveRecommendationRulesForAssessment(input.assessmentId);
    const customizationConfig = await getScoringCustomizationForClient(assessment.userId);
    const emphasisMultipliers = customizationConfig
      ? getEmphasisMultipliers(customizationConfig)
      : null;

    const newPillarRows: Array<{
      pillar: string;
      score: number;
      riskLevel: PrismaRiskLevel;
      breakdown: Prisma.InputJsonValue;
      missingControls: Prisma.InputJsonValue | null;
    }> = [];

    for (const existing of assessment.scores) {
      const pillarConfig = await resolvePillarConfigForAssessment(
        input.assessmentId,
        existing.pillar,
      );
      if (!pillarConfig) continue;

      const activeThresholds = await resolveThresholdsForAssessmentPillar(
        input.assessmentId,
        existing.pillar,
      );
      const visibleQuestions = getVisibleQuestions(allAnswers, pillarConfig.questions);
      const visibleIds = visibleQuestions.map((q) => q.id);
      const hasEmphasis =
        emphasisMultipliers != null &&
        (emphasisMultipliers[existing.pillar] ?? 1) > 1;
      const scoreResult =
        existing.pillar === "identity-risk"
          ? calculateIdentityRiskScore(allAnswers, visibleIds, activeThresholds)
          : hasEmphasis
            ? calculateCustomizedPillarScore(
                allAnswers,
                pillarConfig.pillarData,
                pillarConfig.questions,
                visibleIds,
                emphasisMultipliers!,
                activeThresholds,
              )
            : calculatePillarScore(
                allAnswers,
                pillarConfig.pillarData,
                pillarConfig.questions,
                visibleIds,
                activeThresholds,
              );

      newPillarRows.push({
        pillar: existing.pillar,
        score: scoreResult.score,
        riskLevel: mapRiskLevelToPrisma(scoreResult.riskLevel),
        breakdown: scoreResult.breakdown as unknown as Prisma.InputJsonValue,
        missingControls: (scoreResult.missingControls ?? null) as unknown as Prisma.InputJsonValue | null,
      });
    }

    const pillarScoreMap: Record<string, { score: number; riskLevel: import("@/lib/assessment/types").RiskLevel }> = {};
    for (const p of newPillarRows) {
      pillarScoreMap[p.pillar] = {
        score: p.score,
        riskLevel: p.riskLevel.toLowerCase() as import("@/lib/assessment/types").RiskLevel,
      };
    }
    const aggregatedMissingControls: MissingControl[] = newPillarRows.flatMap((row) => {
      const raw = row.missingControls;
      return Array.isArray(raw) ? (raw as MissingControl[]) : [];
    });

    const engine = new RecommendationEngine();
    const newRecs = await engine.matchAndDedupeRecommendations(
      {
        assessmentId: input.assessmentId,
        userId: assessment.userId,
        pillarScores: pillarScoreMap,
        answers: allAnswers,
        householdProfile: null,
        missingControls: aggregatedMissingControls,
      },
      rulesOverride,
    );

    const rescoredAt = new Date();
    const newVersion = (assessment.version ?? 1) + 1;

    await prisma.$transaction(async (tx) => {
      for (const row of newPillarRows) {
        await tx.pillarScore.upsert({
          where: {
            assessmentId_pillar: { assessmentId: input.assessmentId, pillar: row.pillar },
          },
          create: {
            assessmentId: input.assessmentId,
            pillar: row.pillar,
            score: row.score,
            riskLevel: row.riskLevel,
            breakdown: row.breakdown,
            missingControls: row.missingControls ?? PrismaNs.JsonNull,
          },
          update: {
            score: row.score,
            riskLevel: row.riskLevel,
            breakdown: row.breakdown,
            missingControls: row.missingControls ?? PrismaNs.JsonNull,
            calculatedAt: rescoredAt,
          },
        });
      }

      await tx.assessmentRecommendation.deleteMany({
        where: { assessmentId: input.assessmentId },
      });

      if (newRecs.length > 0) {
        await tx.assessmentRecommendation.createMany({
          data: newRecs.slice(0, 10).map((rec, i) => ({
            assessmentId: input.assessmentId,
            serviceRecommendationId: rec.id,
            triggerReason: { reasons: rec.triggerReason } as unknown as Prisma.InputJsonValue,
            customization:
              rec.customization === null || rec.customization === undefined
                ? PrismaNs.JsonNull
                : (rec.customization as Prisma.InputJsonValue),
            priority: i + 1,
            status: "PENDING" as const,
          })),
          skipDuplicates: true,
        });
      }

      await tx.assessment.update({
        where: { id: input.assessmentId },
        data: ({
          version: newVersion,
          lastRescoredAt: rescoredAt,
          answersChangedAfterCompleteAt: null,
        } as unknown) as Prisma.AssessmentUpdateInput,
      });
    });

    const after = await prisma.assessment.findUnique({
      where: { id: input.assessmentId },
      select: { scores: true, recommendations: true },
    });
    afterSnapshot = {
      pillarScores: after?.scores ?? [],
      recommendations: after?.recommendations ?? [],
    };
    succeeded = true;

    const { revalidatePath } = await import("next/cache");
    revalidatePath("/admin/assessment");
    revalidatePath("/admin/clients");
    revalidatePath("/advisor/pipeline");

    const { emitAssessmentSignals } = await import("@/lib/signals/emit");
    const { evaluateUpsellTriggers } = await import("@/lib/assessment/upsell-triggers");
    type PillarScoreSnapshot = import("@/lib/signals/types").PillarScoreSnapshot;

    const beforeRows = (beforeSnapshot.pillarScores ?? []) as Array<{
      pillar: string;
      score: number;
      riskLevel: string;
    }>;
    const afterRows = (afterSnapshot.pillarScores ?? []) as Array<{
      pillar: string;
      score: number;
      riskLevel: string;
    }>;
    const toSnapshot = (rows: typeof beforeRows): PillarScoreSnapshot[] =>
      rows.map((r) => ({
        pillar: r.pillar,
        score: r.score,
        riskLevel: r.riskLevel,
      }));

    const pillarScoresForTriggers = Object.fromEntries(
      newPillarRows.map((p) => [
        p.pillar,
        {
          resilience: Math.min(100, Math.round((p.score / 3) * 100)),
          riskLevel: p.riskLevel.toLowerCase() as "low" | "medium" | "high" | "critical",
        },
      ]),
    );
    const triggersAfter = evaluateUpsellTriggers({
      pillarScores: pillarScoresForTriggers,
      kriHits: [],
    });
    const priorAssessment = await prisma.assessment.findUnique({
      where: { id: input.assessmentId },
      select: { upsellTriggersFired: true },
    });
    const triggersBefore = Array.isArray(priorAssessment?.upsellTriggersFired)
      ? (priorAssessment.upsellTriggersFired as string[])
      : [];

    void emitAssessmentSignals({
      clientId: assessment.userId,
      assessmentId: input.assessmentId,
      version: newVersion,
      event: "rescored",
      beforeScores: toSnapshot(beforeRows),
      afterScores: toSnapshot(afterRows),
      upsellTriggersBefore: triggersBefore,
      upsellTriggersAfter: triggersAfter,
    });

    return ok({
      assessmentId: input.assessmentId,
      newVersion,
      rescoredAt,
      pillarsChanged: newPillarRows.length,
      recommendationsCount: newRecs.length,
    });
  } catch (err) {
    logSafeError("executeAssessmentRescore", err);
    return fail(safeErrorMessage(err, "Re-score failed"));
  } finally {
    void writeAudit({
      actor: {
        userId: input.actor.userId,
        role: input.actor.role,
        email: input.actor.email,
      },
      action: AUDIT_ACTIONS.ASSESSMENT_RESCORE,
      entityType: "Assessment",
      entityId: input.assessmentId,
      beforeData: beforeSnapshot,
      afterData: afterSnapshot,
      metadata: {
        reason: input.reason ?? null,
        succeeded,
      },
    });
  }
}
