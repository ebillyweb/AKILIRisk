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
import { Question, Pillar } from "@/lib/assessment/types";
import {
  getCustomizationConfig,
  getEmphasisMultipliers,
  getVisibleQuestionIds,
} from "@/lib/assessment/customization";
import { triggerMilestoneNotification } from "@/lib/notifications/triggers";

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

    // Convert responses to answers Record
    const answers: Record<string, unknown> = {};
    responses.forEach((response) => {
      answers[response.questionId] = response.answer;
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

    // Calculate pillar score - customized or standard
    let scoreResult;
    if (pillar === 'identity-risk') {
      // Use identity risk scoring wrapper
      scoreResult = calculateIdentityRiskScore(answers, visibleIds);
    } else if (customizationConfig) {
      // Use customization for governance pillar
      const emphasisMultipliers = getEmphasisMultipliers(customizationConfig);
      scoreResult = calculateCustomizedPillarScore(
        answers,
        pillarConfig.pillarData,
        pillarConfig.questions,
        visibleIds,
        emphasisMultipliers
      );
    } else {
      // Standard scoring
      scoreResult = calculatePillarScore(
        answers,
        pillarConfig.pillarData,
        pillarConfig.questions,
        visibleIds
      );
    }

    // Map risk level to Prisma enum
    const prismaRiskLevel = mapRiskLevelToPrisma(scoreResult.riskLevel);

    // Upsert PillarScore and update Assessment status in transaction
    const [pillarScore] = await prisma.$transaction([
      prisma.pillarScore.upsert({
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
      }),
      // Only update assessment to COMPLETED if both pillars are complete
      // For now, keep existing behavior for backwards compatibility
      prisma.assessment.update({
        where: { id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      }),
    ]);

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
