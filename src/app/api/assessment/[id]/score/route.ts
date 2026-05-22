import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma, RiskLevel as PrismaRiskLevel } from "@prisma/client";
import { calculatePillarScore, calculateCustomizedPillarScore } from "@/lib/assessment/scoring";
import { getVisibleQuestions } from "@/lib/assessment/branching";
import { familyGovernancePillar } from "@/lib/assessment/questions";
import { loadGovernanceQuestionsMerged } from "@/lib/assessment/bank/load-bank";
import { identityRiskPillar, identityRiskQuestions } from "@/lib/identity-risk/questions";
import { calculateIdentityRiskScore } from "@/lib/identity-risk/scoring";
import { getActiveRiskThresholds } from "@/lib/assessment/risk-thresholds";
import { safeDecryptAnswer } from "@/lib/data/response-content";
import { Question, Pillar } from "@/lib/assessment/types";
import {
  getCustomizationConfig,
  getEmphasisMultipliers,
  getVisibleQuestionIds,
} from "@/lib/assessment/customization";
import { triggerMilestoneNotification } from "@/lib/notifications/triggers";
import { AUDIT_ACTIONS, writeAudit } from "@/lib/audit/audit-log";
import { RecommendationEngine } from "@/lib/assessment/engines/recommendation-engine";

/**
 * Assessment Score API Routes
 *
 * POST: Calculate and persist pillar score from assessment responses
 * GET: Retrieve cached score data
 */

/**
 * Map TypeScript RiskLevel string to Prisma enum
 */
function normalizeScorePillar(pillar: string): string {
  if (pillar === 'cyber-risk') return 'family-governance';
  return pillar;
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

/**
 * Helper function to get pillar configuration and questions
 */
async function getPillarConfig(
  pillar: string
): Promise<{ pillarData: Pillar; questions: Question[] } | null> {
  switch (pillar) {
    case "family-governance": {
      const questions = await loadGovernanceQuestionsMerged({ onlyVisible: true });
      return { pillarData: familyGovernancePillar, questions };
    }
    case "identity-risk":
      return { pillarData: identityRiskPillar, questions: identityRiskQuestions };
    default:
      return null;
  }
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
    const pillar = normalizeScorePillar(searchParams.get('pillar') || 'family-governance');

    // Verify ownership
    const assessment = await prisma.assessment.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!assessment) {
      return NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 }
      );
    }

    // 404 (not 403) on ownership mismatch so the response doesn't tell
    // the caller whether a given assessment id exists.
    if (assessment.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 }
      );
    }

    // Load existing score
    const score = await prisma.pillarScore.findUnique({
      where: {
        assessmentId_pillar: {
          assessmentId: id,
          pillar: pillar,
        },
      },
    });

    if (!score) {
      return NextResponse.json(
        { error: "Score not found. Complete assessment to calculate score." },
        { status: 404 }
      );
    }

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
    const pillar = normalizeScorePillar(body.pillar || 'family-governance');

    // Verify ownership
    const assessment = await prisma.assessment.findUnique({
      where: { id },
      select: { userId: true, approvalId: true },
    });

    if (!assessment) {
      return NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 }
      );
    }

    // 404 (not 403) on ownership mismatch so the response doesn't tell
    // the caller whether a given assessment id exists.
    if (assessment.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 }
      );
    }

    // Get pillar configuration
    const pillarConfig = await getPillarConfig(pillar);
    if (!pillarConfig) {
      return NextResponse.json(
        { error: `Unsupported pillar: ${pillar}` },
        { status: 400 }
      );
    }

    // Load responses for this pillar's question IDs (includes rows saved under legacy pillar labels)
    const questionIds = pillarConfig.questions.map((q) => q.id);
    const responses = await prisma.assessmentResponse.findMany({
      where: {
        assessmentId: id,
        skipped: false,
        questionId: { in: questionIds },
      },
    });

    // Convert responses to answers Record. Round-11 commit 2.5b:
    // `answer` is now ciphertext; decrypt at the query layer so the
    // scoring engine sees plaintext. Round-11 cleanup: tamper-
    // resilient — a corrupted row returns null + warns instead of
    // crashing the score request.
    const answers: Record<string, unknown> = {};
    responses.forEach((response) => {
      answers[response.questionId] = safeDecryptAnswer(
        response.answer as unknown as string | null,
        { rowId: response.questionId, column: "AssessmentResponse.answer" }
      );
    });

    // Check for customization from linked approval (governance pillar only)
    let customizationConfig = null;
    let customizationMetadata = null;
    if (pillar === 'family-governance' && assessment.approvalId) {
      const approval = await prisma.intakeApproval.findUnique({
        where: { id: assessment.approvalId },
        select: { focusAreas: true },
      });
      if (approval) {
        customizationConfig = getCustomizationConfig(approval.focusAreas);
        customizationMetadata = {
          isCustomized: true,
          focusAreaCount: approval.focusAreas.length,
          emphasisMultiplier: customizationConfig.emphasisMultiplier,
        };
      }
    }

    // Get visible questions based on customization or standard branching logic
    let visibleQuestions: Question[];
    let visibleIds: string[];
    if (customizationConfig) {
      // Use customization to filter questions by subcategory (governance only)
      visibleIds = getVisibleQuestionIds(customizationConfig.visibleSubCategories, pillarConfig.questions);
      visibleQuestions = pillarConfig.questions.filter(q => visibleIds.includes(q.id));
    } else {
      // Standard branching logic
      visibleQuestions = getVisibleQuestions(answers, pillarConfig.questions);
      visibleIds = visibleQuestions.map(q => q.id);
    }

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

    // A2 (BRD §4.2 + §7.1): fetch the configured Low/Medium/High cutoffs
    // once per scoring run so all three branches use the same thresholds.
    // Falls back to the original 80/60/40 bands when PlatformSettings is
    // missing or DB read fails — see getActiveRiskThresholds().
    //
    // Caveat: this writes the resulting riskLevel into PillarScore (a
    // persisted column). Existing scored assessments retain their previous
    // risk level until the assessment is re-scored. Threshold changes
    // apply to NEW scoring runs only.
    const activeThresholds = await getActiveRiskThresholds();

    // Calculate pillar score - customized or standard
    let scoreResult;
    if (pillar === 'identity-risk') {
      // Use identity risk scoring wrapper
      scoreResult = calculateIdentityRiskScore(answers, visibleIds, activeThresholds);
    } else if (customizationConfig) {
      // Use customization for governance pillar
      const emphasisMultipliers = getEmphasisMultipliers(customizationConfig);
      scoreResult = calculateCustomizedPillarScore(
        answers,
        pillarConfig.pillarData,
        pillarConfig.questions,
        visibleIds,
        emphasisMultipliers,
        activeThresholds
      );
    } else {
      // Standard scoring
      scoreResult = calculatePillarScore(
        answers,
        pillarConfig.pillarData,
        pillarConfig.questions,
        visibleIds,
        activeThresholds
      );
    }

    // Map risk level to Prisma enum
    const prismaRiskLevel = mapRiskLevelToPrisma(scoreResult.riskLevel);

    const recommendationEngine = new RecommendationEngine();
    const matchedRecommendations = await recommendationEngine.matchAndDedupeRecommendations({
      assessmentId: id,
      userId: session.user.id,
      pillarScores: {
        [pillar]: {
          score: scoreResult.score,
          riskLevel: scoreResult.riskLevel,
        },
      },
      answers,
      householdProfile: null,
      missingControls: scoreResult.missingControls,
    });

    const pillarScore = await prisma.$transaction(async (tx) => {
      const saved = await tx.pillarScore.upsert({
        where: {
          assessmentId_pillar: {
            assessmentId: id,
            pillar: pillar,
          },
        },
        create: {
          assessmentId: id,
          pillar: pillar,
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

      await tx.assessment.update({
        where: { id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

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

      return saved;
    });

    // Trigger milestone notification for assessment completion (fire-and-forget)
    void triggerMilestoneNotification(assessment.userId, 'Assessment Complete');

    const responseData: any = {
      score: pillarScore.score,
      riskLevel: pillarScore.riskLevel,
      breakdown: pillarScore.breakdown,
      missingControls: pillarScore.missingControls,
      completedAt: pillarScore.calculatedAt,
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
