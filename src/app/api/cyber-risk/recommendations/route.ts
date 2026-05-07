import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { generateCyberRecommendations, CyberRecommendation } from "@/lib/cyber-risk/recommendations";
import { ScoreResult, CategoryScore, MissingControl } from "@/lib/assessment/types";
import { decryptAnswer } from "@/lib/data/response-content";

/**
 * Cyber Risk Recommendations API
 *
 * POST: Generate fresh recommendations from assessment data
 * GET: Retrieve cached recommendations if available
 */

/** Narrow `pillarScore.missingControls` (Prisma Json) into the cached
 *  recommendations shape we wrote in POST. Returns null if the field is
 *  null, the legacy raw-array shape, or otherwise unrecognized. */
function extractCachedRecommendations(
  raw: unknown
): { recommendations: CyberRecommendation[]; generatedAt: string } | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as { recommendations?: unknown; generatedAt?: unknown };
  if (!Array.isArray(obj.recommendations)) return null;
  return {
    recommendations: obj.recommendations as CyberRecommendation[],
    generatedAt:
      typeof obj.generatedAt === "string" ? obj.generatedAt : new Date(0).toISOString(),
  };
}

/**
 * POST /api/cyber-risk/recommendations
 * Generate AI recommendations from assessment results
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { assessmentId } = body;

    if (!assessmentId || typeof assessmentId !== 'string') {
      return NextResponse.json(
        { error: "Assessment ID is required" },
        { status: 400 }
      );
    }

    // Verify assessment ownership
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { userId: true },
    });

    if (!assessment) {
      return NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 }
      );
    }

    // 404 on ownership mismatch — matches the no-such-assessment shape
    // above so the response doesn't leak existence.
    if (assessment.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 }
      );
    }

    // Load cyber risk pillar score
    const pillarScore = await prisma.pillarScore.findUnique({
      where: {
        assessmentId_pillar: {
          assessmentId,
          pillar: 'cyber-risk',
        },
      },
    });

    if (!pillarScore) {
      return NextResponse.json(
        { error: "Cyber risk assessment not completed. Complete the assessment to generate recommendations." },
        { status: 400 }
      );
    }

    // Load assessment responses for cyber risk pillar
    const responses = await prisma.assessmentResponse.findMany({
      where: {
        assessmentId,
        skipped: false,
        // Filter for cyber risk questions (assuming questionId starts with 'cyber-')
        questionId: { startsWith: 'cyber-' },
      },
      select: { questionId: true, answer: true },
    });

    // Convert responses to answers record. Round-11 commit 2.5b:
    // `answer` is now ciphertext; decrypt at the query layer.
    const answers: Record<string, unknown> = {};
    responses.forEach((response) => {
      answers[response.questionId] = response.answer
        ? decryptAnswer(response.answer as unknown as string)
        : null;
    });

    // Build ScoreResult from PillarScore data
    const scoreResult: ScoreResult = {
      score: pillarScore.score,
      riskLevel: pillarScore.riskLevel.toLowerCase() as 'low' | 'medium' | 'high' | 'critical',
      breakdown: pillarScore.breakdown as unknown as CategoryScore[],
      missingControls: (pillarScore.missingControls as unknown as MissingControl[]) || [],
    };

    // Generate AI recommendations
    const recommendations = await generateCyberRecommendations(scoreResult, answers);

    // Cache recommendations in the missingControls field (extend structure)
    const updatedMissingControls = {
      controls: scoreResult.missingControls,
      recommendations,
      generatedAt: new Date().toISOString(),
    };

    await prisma.pillarScore.update({
      where: {
        assessmentId_pillar: {
          assessmentId,
          pillar: 'cyber-risk',
        },
      },
      data: {
        missingControls: updatedMissingControls as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      recommendations,
    });
  } catch (error) {
    console.error("Error generating cyber risk recommendations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cyber-risk/recommendations
 * Retrieve cached recommendations if available
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get('assessmentId');

    if (!assessmentId) {
      return NextResponse.json(
        { error: "Assessment ID is required" },
        { status: 400 }
      );
    }

    // Verify assessment ownership
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { userId: true },
    });

    if (!assessment) {
      return NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 }
      );
    }

    // 404 on ownership mismatch — matches the no-such-assessment shape
    // above so the response doesn't leak existence.
    if (assessment.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 }
      );
    }

    // Load pillar score with cached recommendations
    const pillarScore = await prisma.pillarScore.findUnique({
      where: {
        assessmentId_pillar: {
          assessmentId,
          pillar: 'cyber-risk',
        },
      },
    });

    if (!pillarScore) {
      return NextResponse.json(
        { error: "Cyber risk assessment not completed" },
        { status: 404 }
      );
    }

    // Extract cached recommendations if available. Two shapes can live
    // in `pillarScore.missingControls`:
    //   - the wrapped cache object written by POST below:
    //     `{ controls, recommendations, generatedAt }`
    //   - the legacy raw array of `MissingControl` from earlier scoring runs
    // Only the wrapped shape carries cached recommendations; otherwise we
    // tell the caller to regenerate. Defensive duck-typing avoids leaking
    // the `as any` cast into a runtime KeyError if the shape ever shifts
    // again.
    const cached = extractCachedRecommendations(pillarScore.missingControls);
    if (cached) {
      return NextResponse.json({
        recommendations: cached.recommendations,
        generatedAt: cached.generatedAt,
        cached: true,
      });
    }

    // No cached recommendations available
    return NextResponse.json(
      { error: "No recommendations available. Generate recommendations first." },
      { status: 404 }
    );
  } catch (error) {
    console.error("Error retrieving cyber risk recommendations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}