import "server-only";

import { prisma } from "@/lib/db";
import type { FamilyAnalyticsData, AssessmentComparison, GovernanceTrendPoint, CategoryBreakdownPoint } from "./types";
import { CATEGORY_LABELS } from "./formatters";
import { decryptUserEmail } from "@/lib/auth/user-email";

// Pillar weights — legacy map for historical rows; prefer snapshot weights at runtime.
export const PILLAR_WEIGHTS = {
  governance: 9,
  "cyber-digital": 14,
  "physical-security": 10,
  insurance: 14,
  "geographic-environmental": 10,
  "reputational-social": 7,
  "liquidity-cash": 12,
  "tax-exposure": 10,
  "estate-succession": 6,
  "ai-emerging-tech": 8,
  /** Historical category rows */
  "health-medical-preparedness": 11,
  "decision-making-authority": 13,
  "access-controls": 13,
  "trust-estate-governance": 9,
  "marriage-relationship-risk": 9,
  "succession-planning": 9,
  "behavior-standards": 13,
  "business-involvement": 9,
  "documentation-communication": 13,
} as const;

/**
 * Calculate weighted overall score from pillar scores
 */
export function calculateWeightedScoreFromPillars(
  pillarScores: { pillar: string; score: number }[],
  weightMap?: Record<string, number>,
): number {
  let totalScore = 0;
  let totalWeight = 0;

  for (const pillarScore of pillarScores) {
    const weight =
      weightMap?.[pillarScore.pillar] ??
      PILLAR_WEIGHTS[pillarScore.pillar as keyof typeof PILLAR_WEIGHTS];
    if (weight) {
      totalScore += pillarScore.score * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0 ? totalScore / totalWeight : 0;
}

function calculateWeightedScore(pillarScores: { pillar: string; score: number }[]): number {
  return calculateWeightedScoreFromPillars(pillarScores);
}

/**
 * Determine trend direction based on score comparison
 */
function getTrendDirection(currentScore: number, previousScore: number | null): 'improving' | 'declining' | 'stable' | 'new' {
  if (previousScore === null) return 'new';

  const difference = currentScore - previousScore;
  if (difference > 0.3) return 'improving';
  if (difference < -0.3) return 'declining';
  return 'stable';
}

/**
 * Get comprehensive analytics data for a family including trends and breakdowns
 */
export async function getFamilyGovernanceTrends(
  clientId: string,
  advisorProfileId: string
): Promise<FamilyAnalyticsData> {
  // Verify advisor-client relationship
  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: {
      advisorId: advisorProfileId,
      clientId: clientId,
      status: 'ACTIVE',
    },
    include: {
      client: {
        select: {
          id: true,
          // Round-11 commit 2.4b: ciphertext, decrypt at usage.
          emailCiphertext: true,
        }
      }
    }
  });

  if (!assignment) {
    throw new Error('Advisor does not have access to this client');
  }

  // Get all completed assessments with scores
  const assessments = await prisma.assessment.findMany({
    where: {
      userId: clientId,
      status: 'COMPLETED',
    },
    include: {
      scores: true,
    },
    orderBy: {
      completedAt: 'asc',
    },
  });

  // Build trend data and assessments array
  const trendData: GovernanceTrendPoint[] = [];
  const assessmentsData: AssessmentComparison[] = [];
  let previousScore: number | null = null;

  for (const assessment of assessments) {
    if (!assessment.completedAt) continue;

    const overallScore = calculateWeightedScore(assessment.scores);

    // Add to trend data
    trendData.push({
      date: assessment.completedAt.toISOString(),
      overallScore,
      assessmentId: assessment.id,
    });

    // Build category breakdown
    const categories: CategoryBreakdownPoint[] = assessment.scores.map(score => ({
      categoryId: score.pillar,
      categoryName: CATEGORY_LABELS[score.pillar] || score.pillar,
      score: score.score,
      weight: PILLAR_WEIGHTS[score.pillar as keyof typeof PILLAR_WEIGHTS] || 0,
    }));

    // Add to assessments data
    assessmentsData.push({
      assessmentId: assessment.id,
      completedAt: assessment.completedAt.toISOString(),
      overallScore,
      categories,
      trendDirection: getTrendDirection(overallScore, previousScore),
    });

    previousScore = overallScore;
  }

  // Get latest breakdown from most recent assessment
  const latestBreakdown: CategoryBreakdownPoint[] =
    assessmentsData.length > 0 ? assessmentsData[assessmentsData.length - 1].categories : [];

  // Build client name
  // Round-11 commit 2.4b: name fallback now decrypts ciphertext.
  const clientName = decryptUserEmail(assignment.client.emailCiphertext);

  return {
    clientId,
    clientName,
    trendData,
    latestBreakdown,
    assessments: assessmentsData,
  };
}

/**
 * Get single assessment comparison data with advisor access verification
 */
export async function getAssessmentComparison(
  assessmentId: string,
  advisorProfileId: string
): Promise<AssessmentComparison> {
  // Get assessment with scores
  const assessment = await prisma.assessment.findUnique({
    where: {
      id: assessmentId,
    },
    include: {
      scores: true,
    },
  });

  if (!assessment || !assessment.completedAt) {
    throw new Error('Assessment not found or not completed');
  }

  // Verify advisor has access to this client
  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: {
      advisorId: advisorProfileId,
      clientId: assessment.userId,
      status: 'ACTIVE',
    }
  });

  if (!assignment) {
    throw new Error('Advisor does not have access to this assessment');
  }

  const overallScore = calculateWeightedScore(assessment.scores);

  // Build category breakdown
  const categories: CategoryBreakdownPoint[] = assessment.scores.map(score => ({
    categoryId: score.pillar,
    categoryName: CATEGORY_LABELS[score.pillar] || score.pillar,
    score: score.score,
    weight: PILLAR_WEIGHTS[score.pillar as keyof typeof PILLAR_WEIGHTS] || 0,
  }));

  return {
    assessmentId: assessment.id,
    completedAt: assessment.completedAt.toISOString(),
    overallScore,
    categories,
    trendDirection: 'new', // Single assessment context
  };
}