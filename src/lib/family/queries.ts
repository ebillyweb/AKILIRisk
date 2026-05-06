import "server-only";

import { prisma } from "@/lib/db";
import { PILLAR_WEIGHTS } from "@/lib/analytics/queries";
import { CATEGORY_LABELS } from "@/lib/analytics/formatters";
import type { FamilyDashboardData, FamilyHouseholdMember, FamilyPillarScore, FamilyHistoricalAssessment } from "./types";

/**
 * Calculate weighted overall score from pillar scores
 */
export function calculateWeightedScore(pillarScores: { pillar: string; score: number }[]): number {
  let totalScore = 0;
  let totalWeight = 0;

  for (const pillarScore of pillarScores) {
    const weight = PILLAR_WEIGHTS[pillarScore.pillar as keyof typeof PILLAR_WEIGHTS];
    if (weight) {
      totalScore += pillarScore.score * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0 ? totalScore / totalWeight : 0;
}

/**
 * Determine trend direction based on score comparison
 */
export function getTrendDirection(currentScore: number, previousScore: number | null): 'improving' | 'declining' | 'stable' | 'new' {
  if (previousScore === null) return 'new';

  const difference = currentScore - previousScore;
  if (difference > 0.3) return 'improving';
  if (difference < -0.3) return 'declining';
  return 'stable';
}

/**
 * Get comprehensive family dashboard data for the authenticated user
 */
export async function getFamilyDashboardData(userId: string): Promise<FamilyDashboardData> {
  // Query user with all related data
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      householdMembers: {
        select: {
          displayLabel: true,
          birthYear: true,
          sex: true,
          relationship: true,
          governanceRoles: true,
        },
      },
      assessments: {
        where: {
          status: 'COMPLETED',
        },
        include: {
          scores: true,
        },
        orderBy: {
          completedAt: 'desc',
        },
      },
      intakeInterviews: {
        include: {
          approval: {
            select: {
              focusAreas: true,
            },
          },
        },
        orderBy: {
          completedAt: 'desc',
        },
        take: 1,
      },
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Map household members
  const householdMembers: FamilyHouseholdMember[] = user.householdMembers.map((member) => ({
    displayLabel: member.displayLabel,
    birthYear: member.birthYear,
    sex: member.sex,
    relationship: member.relationship,
    governanceRoles: member.governanceRoles,
  }));

  // Process assessments
  const historicalAssessments: FamilyHistoricalAssessment[] = [];
  let currentScore: number | null = null;
  let currentPillarScores: FamilyPillarScore[] = [];
  let previousScore: number | null = null;

  for (let i = 0; i < user.assessments.length; i++) {
    const assessment = user.assessments[i];

    if (!assessment.completedAt) continue;

    const overallScore = calculateWeightedScore(assessment.scores);

    // Map pillar scores with category labels and weights
    const pillarScores: FamilyPillarScore[] = assessment.scores.map(score => ({
      pillar: score.pillar,
      pillarName: CATEGORY_LABELS[score.pillar] || score.pillar,
      score: score.score,
      weight: PILLAR_WEIGHTS[score.pillar as keyof typeof PILLAR_WEIGHTS] || 0,
      riskLevel: score.riskLevel,
    }));

    // Determine trend direction (comparing to previous assessment in chronological order)
    const trendDirection = getTrendDirection(overallScore, previousScore);

    const historicalAssessment: FamilyHistoricalAssessment = {
      assessmentId: assessment.id,
      completedAt: assessment.completedAt.toISOString(),
      overallScore,
      pillarScores,
      trendDirection,
    };

    historicalAssessments.push(historicalAssessment);

    // Set current scores from most recent assessment (first in desc order)
    if (i === 0) {
      currentScore = overallScore;
      currentPillarScores = pillarScores;
    }

    previousScore = overallScore;
  }

  // Extract advisor emphasis from latest intake approval
  const advisorEmphasis: string[] =
    user.intakeInterviews[0]?.approval?.focusAreas || [];

  return {
    householdMembers,
    currentScore,
    currentPillarScores,
    historicalAssessments,
    advisorEmphasis,
    hasMultipleAssessments: historicalAssessments.length > 1,
  };
}