import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma, RiskLevel as PrismaRiskLevel } from "@prisma/client";
import { calculatePillarScore, calculateCustomizedPillarScore } from "@/lib/assessment/scoring";
import { getVisibleQuestions } from "@/lib/assessment/branching";
import { getPillarAssessmentConfig } from "@/lib/assessment/pillar-config";
import {
  normalizePillarSlug,
  normalizePillarScoreId,
} from "@/lib/assessment/pillar-registry";
import {
  pillarScoresRecordFromRows,
  syncAssessmentCompletionStatus,
} from "@/lib/assessment/assessment-completion";
import { getActiveRiskThresholds } from "@/lib/assessment/risk-thresholds";
import { loadAssessmentAnswersForQuestions } from "@/lib/assessment/pillar-answer-loader";
import { resolvePillarNarratives } from "@/lib/assessment/pillar-outcomes";
import {
  getEmphasisMultipliers,
} from "@/lib/assessment/customization";
import { getScoringCustomizationForClient } from "@/lib/data/assessment-customization";
import { loadSnapshotForAssessment } from "@/lib/methodology/snapshot";
import {
  pillarAssessmentConfigFromSnapshot,
} from "@/lib/methodology/assessment-from-snapshot";
import {
  recommendationRulesFromSnapshot,
  snapshotThresholdForPillar,
} from "@/lib/methodology/snapshot-helpers";
import { triggerMilestoneNotification } from "@/lib/notifications/triggers";
import { triggerPreviewAvailable } from "@/lib/notifications/deliverable-phase-triggers";
import { AUDIT_ACTIONS, writeAudit } from "@/lib/audit/audit-log";
import { RecommendationEngine } from "@/lib/assessment/engines/recommendation-engine";
import { emitAssessmentSignals } from "@/lib/signals/emit";
import type { PillarScoreSnapshot } from "@/lib/signals/types";
import { evaluateClientAssessmentSummaryAccess } from "@/lib/client/assessment-summary-gate";
import { isPillarInAssessmentScope } from "@/lib/assessment/included-pillars";
import { getPlatformPillarCatalog } from "@/lib/methodology/cached-pillar-catalog";
import {
  authorizeAssessmentApiAccess,
  markFacilitatedSessionPreviewIfComplete,
} from "@/lib/facilitated/assessment-access";

/**
 * Assessment Score API Routes
 *
 * POST: Calculate and persist pillar score from assessment responses
 * GET: Retrieve cached score data
 */

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

/** Resolve a stored PillarScore row (canonical or legacy pillar key). */
async function findPillarScore(assessmentId: string, pillarSlug: string) {
  const canonical = normalizePillarSlug(pillarSlug);
  const candidates = [canonical];
  if (pillarSlug !== canonical) {
    candidates.push(pillarSlug);
  }
  if (canonical === "governance") {
    candidates.push("family-governance");
  }
  const unique = candidates.filter((v, i, a) => a.indexOf(v) === i);
  for (const pillar of unique) {
    const score = await prisma.pillarScore.findUnique({
      where: { assessmentId_pillar: { assessmentId, pillar } },
    });
    if (score) return score;
  }
  return null;
}

/**
 * GET /api/assessment/[id]/score
 * Retrieve cached score data for an assessment
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const pillar = normalizePillarSlug(searchParams.get("pillar") || "governance");
    const facilitatedSessionId = searchParams.get("facilitatedSessionId") ?? undefined;

    const assessment = await prisma.assessment.findUnique({
      where: { id },
      select: {
        userId: true,
        deliverablePhase: true,
        includedPillars: true,
        scores: { select: { pillar: true } },
      },
    });

    if (!assessment) {
      return NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 }
      );
    }

    const access = await authorizeAssessmentApiAccess({
      assessmentId: id,
      userId: session.user.id,
      userRole: session.user.role,
      facilitatedSessionId,
    });
    if (!access) {
      return NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 }
      );
    }

    const catalog = await getPlatformPillarCatalog();

    if (!access.isFacilitated) {
      const summaryAccess = evaluateClientAssessmentSummaryAccess({
        pillarScores: assessment.scores,
        deliverablePhase: assessment.deliverablePhase,
        includedPillars: assessment.includedPillars,
        catalog,
      });
      if (!summaryAccess.canViewSummary) {
        return NextResponse.json(
          {
            error: summaryAccess.allPillarsComplete
              ? "Your assessment summary will be available after your advisor publishes your Risk Profile."
              : "Complete all assessment pillars before viewing your summary.",
            code: "SUMMARY_LOCKED",
          },
          { status: 403 }
        );
      }
    }

    const score = await findPillarScore(id, pillar);

    if (!score) {
      return NextResponse.json(
        { error: "Score not found. Complete assessment to calculate score." },
        { status: 404 }
      );
    }

    const snapshot = await loadSnapshotForAssessment(id);
    const snapshotConfig = snapshot
      ? pillarAssessmentConfigFromSnapshot(snapshot, pillar, catalog)
      : null;
    const pillarConfig =
      snapshotConfig ?? (await getPillarAssessmentConfig(pillar));
    const questionIds = pillarConfig?.questions.map((q) => q.id) ?? [];
    const answers = await loadAssessmentAnswersForQuestions(id, questionIds);
    const snapshotNarrative = snapshot?.pillarNarratives[pillar];
    const pillarNarratives =
      pillarConfig != null
        ? resolvePillarNarratives(
            pillar,
            score.score,
            score.riskLevel,
            answers,
            pillarConfig.questions,
            snapshotNarrative,
          )
        : [];

    // Round-12 audit-bucket close-out: client (or owner) self-read of
    // their scored assessment. Fire-and-forget — writeAudit catches its
    // own errors. metadata.pillar lets the audit log distinguish cross-
    // pillar tab switches in /assessment/results without inflating the
    // entityId namespace. No dedupe in v1; if volume becomes an issue
    // wrap with the audio-stream-dedupe.ts pattern.
    void writeAudit({
      actor: {
        userId: session.user.id,
        role: session.user.role ?? null,
        email: session.user.email ?? null,
      },
      action: AUDIT_ACTIONS.DATA_ACCESS_OWN_ASSESSMENT_RESULTS,
      entityType: "Assessment",
      entityId: id,
      metadata: {
        assessmentId: id,
        pillar,
      },
      request,
    });

    return NextResponse.json({
      score: score.score,
      riskLevel: score.riskLevel,
      breakdown: score.breakdown,
      missingControls: score.missingControls,
      pillarNarratives,
      completedAt: score.calculatedAt,
    });
  } catch (error) {
    console.error("Error fetching score:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/assessment/[id]/score
 * Calculate and persist pillar score from assessment responses
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const pillar = normalizePillarSlug(body.pillar || "governance");
    const facilitatedSessionId =
      typeof body.facilitatedSessionId === "string"
        ? body.facilitatedSessionId
        : undefined;

    const assessment = await prisma.assessment.findUnique({
      where: { id },
      select: {
        userId: true,
        approvalId: true,
        status: true,
        version: true,
        includedPillars: true,
        scores: { select: { pillar: true, score: true, riskLevel: true } },
      },
    });

    if (!assessment) {
      return NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 }
      );
    }

    const access = await authorizeAssessmentApiAccess({
      assessmentId: id,
      userId: session.user.id,
      userRole: session.user.role,
      facilitatedSessionId,
    });
    if (!access) {
      return NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 }
      );
    }

    const clientId = access.clientId;
    const catalog = await getPlatformPillarCatalog();

    if (!isPillarInAssessmentScope(pillar, assessment.includedPillars, catalog)) {
      return NextResponse.json(
        {
          error: "This pillar is not included in your assessment scope.",
          code: "PILLAR_OUT_OF_SCOPE",
        },
        { status: 400 },
      );
    }

    const snapshot = await loadSnapshotForAssessment(id);
    const pillarConfigFromSnapshot = snapshot
      ? pillarAssessmentConfigFromSnapshot(snapshot, pillar, catalog)
      : null;
    const pillarConfig =
      pillarConfigFromSnapshot ?? (await getPillarAssessmentConfig(pillar));
    if (!pillarConfig) {
      return NextResponse.json(
        { error: `Unsupported pillar: ${pillar}` },
        { status: 400 }
      );
    }

    const questionIds = pillarConfig.questions.map((q) => q.id);
    const answers = await loadAssessmentAnswersForQuestions(id, questionIds);

    let customizationConfig = null;
    let customizationMetadata = null;
    const scoringCustomization = await getScoringCustomizationForClient(clientId);
    if (scoringCustomization) {
      customizationConfig = scoringCustomization;
      customizationMetadata = {
        isCustomized: scoringCustomization.isCustomized,
        focusAreaCount: scoringCustomization.emphasisAreas.length,
        emphasisMultiplier: scoringCustomization.emphasisMultiplier,
      };
    }

    const visibleQuestions = getVisibleQuestions(answers, pillarConfig.questions);
    const visibleIds = visibleQuestions.map((q) => q.id);

    // Check minimum completion threshold (50% of visible questions)
    const totalVisibleQuestions = visibleQuestions.length;
    const answeredCount = visibleQuestions.filter((q) => {
      const a = answers[q.id];
      return a !== undefined && a !== null;
    }).length;
    const completionPercentage = (answeredCount / totalVisibleQuestions) * 100;

    if (completionPercentage < 50) {
      return NextResponse.json(
        {
          error: `Incomplete assessment cannot be scored. Please answer at least 50% of applicable questions. Currently: ${Math.round(completionPercentage)}% (${answeredCount}/${totalVisibleQuestions})`,
        },
        { status: 400 }
      );
    }

    const activeThresholds =
      (snapshot && snapshotThresholdForPillar(snapshot, pillar)) ??
      (await getActiveRiskThresholds());

    const emphasisMultipliers = customizationConfig
      ? getEmphasisMultipliers(customizationConfig)
      : null;
    const hasEmphasis =
      emphasisMultipliers != null &&
      (emphasisMultipliers[pillar] ?? 1) > 1;

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

    // Map risk level to Prisma enum
    const prismaRiskLevel = mapRiskLevelToPrisma(scoreResult.riskLevel);

    const pillarScore = await prisma.$transaction(async (tx) => {
      const saved = await tx.pillarScore.upsert({
        where: {
          assessmentId_pillar: {
            assessmentId: id,
            pillar,
          },
        },
        create: {
          assessmentId: id,
          pillar,
          score: scoreResult.score,
          riskLevel: prismaRiskLevel,
          breakdown: scoreResult.breakdown as unknown as Prisma.InputJsonValue,
          missingControls: scoreResult.missingControls as unknown as Prisma.InputJsonValue,
        },
        update: {
          score: scoreResult.score,
          riskLevel: prismaRiskLevel,
          breakdown: scoreResult.breakdown as unknown as Prisma.InputJsonValue,
          missingControls: scoreResult.missingControls as unknown as Prisma.InputJsonValue,
          calculatedAt: new Date(),
        },
      });

      const allScores = await tx.pillarScore.findMany({
        where: { assessmentId: id },
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
      const rulesOverride = snapshot
        ? recommendationRulesFromSnapshot(snapshot)
        : undefined;
      const matchedRecommendations =
        await recommendationEngine.matchAndDedupeRecommendations(
          {
            assessmentId: id,
            userId: clientId,
            pillarScores: pillarScoresMap,
            answers,
            householdProfile: null,
            missingControls: scoreResult.missingControls,
          },
          rulesOverride,
        );

      await tx.assessmentRecommendation.deleteMany({ where: { assessmentId: id } });

      if (matchedRecommendations.length > 0) {
        await tx.assessmentRecommendation.createMany({
          data: matchedRecommendations.slice(0, 10).map((rec, index) => ({
            assessmentId: id,
            serviceRecommendationId: rec.id,
            triggerReason: { reasons: rec.triggerReason } as unknown as Prisma.InputJsonValue,
            customization: (rec.customization ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
            priority: index + 1,
            status: "PENDING",
          })),
        });
      }

      const { allPillarsScored } = await syncAssessmentCompletionStatus(tx, id);

      return { saved, allPillarsScored };
    });

    if (pillarScore.allPillarsScored) {
      void triggerMilestoneNotification(clientId, "Assessment Complete");
      void triggerPreviewAvailable(id);
      if (facilitatedSessionId) {
        void markFacilitatedSessionPreviewIfComplete(facilitatedSessionId);
      }
    }

    const beforeSnapshots: PillarScoreSnapshot[] = (assessment.scores ?? []).map((s) => ({
      pillar: s.pillar,
      score: s.score,
      riskLevel: s.riskLevel,
    }));
    const afterRows = await prisma.pillarScore.findMany({
      where: { assessmentId: id },
      select: { pillar: true, score: true, riskLevel: true },
    });
    const afterSnapshots: PillarScoreSnapshot[] = afterRows.map((s) => ({
      pillar: s.pillar,
      score: s.score,
      riskLevel: s.riskLevel,
    }));
    const wasCompleted = assessment.status === "COMPLETED";
    void emitAssessmentSignals({
      clientId,
      assessmentId: id,
      version: assessment.version ?? 1,
      event:
        pillarScore.allPillarsScored && !wasCompleted ? "completed" : "pillar_scored",
      beforeScores: beforeSnapshots,
      afterScores: afterSnapshots,
    });

    const snapshotNarrative = snapshot?.pillarNarratives[pillar];
    const pillarNarratives = resolvePillarNarratives(
      pillar,
      scoreResult.score,
      scoreResult.riskLevel,
      answers,
      pillarConfig.questions,
      snapshotNarrative,
    );

    const updatedAssessment = await prisma.assessment.findUnique({
      where: { id },
      select: {
        deliverablePhase: true,
        includedPillars: true,
        scores: { select: { pillar: true } },
      },
    });
    const summaryAccess = updatedAssessment
      ? evaluateClientAssessmentSummaryAccess({
          pillarScores: updatedAssessment.scores,
          deliverablePhase: updatedAssessment.deliverablePhase,
          includedPillars: updatedAssessment.includedPillars,
          catalog,
        })
      : { canViewSummary: false, allPillarsComplete: false };

    const responseData: Record<string, unknown> = {
      score: pillarScore.saved.score,
      riskLevel: pillarScore.saved.riskLevel,
      breakdown: pillarScore.saved.breakdown,
      missingControls: pillarScore.saved.missingControls,
      pillarNarratives,
      completedAt: pillarScore.saved.calculatedAt,
      allPillarsScored: pillarScore.allPillarsScored,
      canViewSummary: summaryAccess.canViewSummary,
    };

    // Add customization metadata if applicable
    if (customizationMetadata) {
      responseData.customization = customizationMetadata;
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Error calculating score:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
