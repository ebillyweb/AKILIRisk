/**
 * Assessment Results API
 * GET /api/assessment/enhanced/[id]/results
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { decryptAnswer } from '@/lib/data/response-content';

interface AssessmentResult {
  assessment: {
    id: string;
    status: string;
    completedAt: Date | null;
    version: number;
  };
  pillarScores: Array<{
    pillar: string;
    score: number;
    riskLevel: string;
    breakdown: any;
    missingControls: any[];
  }>;
  overallScore: {
    score: number;
    riskLevel: string;
    completionPercentage: number;
  };
  recommendations: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    priority: number;
    estimatedCost?: string;
    timeframe?: string;
    status: string;
    triggerReason: any;
  }>;
  answers: Record<string, unknown>;
  missingControls: any[];
  actionPlan: Array<{
    pillar: string;
    priority: number;
    description: string;
    recommendation: string;
    timeframe?: string;
    estimatedCost?: string;
  }>;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: assessmentId } = await context.params;

    // Fetch assessment with all related data
    const assessment = await prisma.assessment.findFirst({
      where: {
        id: assessmentId,
        userId: session.user.id,
      },
      include: {
        responses: true,
        scores: true,
        recommendations: {
          include: {
            serviceRecommendation: true,
          },
          orderBy: { priority: 'asc' }
        },
      }
    });

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // Calculate overall score from pillar scores
    const overallScore = calculateOverallScore(assessment.scores);

    // Transform answers to key-value format. Round-11 commit 2.5b:
    // `answer` is now ciphertext; decrypt at the query layer.
    const answers = assessment.responses.reduce((acc, response) => {
      acc[response.questionId] = response.answer
        ? decryptAnswer(response.answer as unknown as string)
        : null;
      return acc;
    }, {} as Record<string, unknown>);

    // Collect all missing controls across pillars
    const allMissingControls = assessment.scores.flatMap(score =>
      Array.isArray(score.missingControls) ? score.missingControls : []
    );

    // Generate action plan from missing controls and recommendations
    const actionPlan = generateActionPlan(assessment.scores, assessment.recommendations);

    const result: AssessmentResult = {
      assessment: {
        id: assessment.id,
        status: assessment.status,
        completedAt: assessment.completedAt,
        version: assessment.version,
      },
      pillarScores: assessment.scores.map(score => ({
        pillar: score.pillar,
        score: score.score,
        riskLevel: score.riskLevel,
        breakdown: score.breakdown,
        missingControls: Array.isArray(score.missingControls) ? score.missingControls : [],
      })),
      overallScore,
      recommendations: assessment.recommendations.map((rec) => ({
        id: rec.serviceRecommendation.id,
        name: rec.serviceRecommendation.name,
        description: rec.serviceRecommendation.description,
        category: rec.serviceRecommendation.category,
        priority: rec.priority,
        estimatedCost: rec.serviceRecommendation.estimatedCost ?? undefined,
        timeframe: rec.serviceRecommendation.timeframe ?? undefined,
        status: rec.status,
        triggerReason: rec.triggerReason,
      })),
      answers,
      missingControls: allMissingControls,
      actionPlan,
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching assessment results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assessment results' },
      { status: 500 }
    );
  }
}

function calculateOverallScore(pillarScores: any[]): { score: number; riskLevel: string; completionPercentage: number } {
  if (pillarScores.length === 0) {
    return { score: 0, riskLevel: 'UNKNOWN', completionPercentage: 0 };
  }

  // Weight pillars equally for overall score
  const totalScore = pillarScores.reduce((sum, score) => sum + score.score, 0);
  const averageScore = totalScore / pillarScores.length;

  // Determine overall risk level based on average score
  let riskLevel: string;
  if (averageScore >= 2.5) {
    riskLevel = 'LOW';
  } else if (averageScore >= 1.5) {
    riskLevel = 'MEDIUM';
  } else if (averageScore >= 0.5) {
    riskLevel = 'HIGH';
  } else {
    riskLevel = 'CRITICAL';
  }

  // Completion percentage (assuming 6 pillars total)
  const totalPillars = 6;
  const completionPercentage = (pillarScores.length / totalPillars) * 100;

  return {
    score: Math.round(averageScore * 100) / 100,
    riskLevel,
    completionPercentage: Math.round(completionPercentage),
  };
}

function generateActionPlan(pillarScores: any[], recommendations: any[]): any[] {
  const actionPlan: any[] = [];

  // Add missing controls as action items
  pillarScores.forEach(score => {
    const missingControls = Array.isArray(score.missingControls) ? score.missingControls : [];
    missingControls.forEach((control: any, index: number) => {
      actionPlan.push({
        pillar: score.pillar,
        priority: control.severity === 'high' ? 1 : control.severity === 'medium' ? 2 : 3,
        description: control.description,
        recommendation: control.recommendation,
        timeframe: 'Immediate',
        estimatedCost: 'TBD',
      });
    });
  });

  // Add high-priority service recommendations
  recommendations
    .filter(rec => rec.priority <= 3)
    .forEach(rec => {
      actionPlan.push({
        pillar: 'Multiple',
        priority: rec.priority,
        description: rec.serviceRecommendation.name,
        recommendation: rec.serviceRecommendation.description,
        timeframe: rec.serviceRecommendation.timeframe,
        estimatedCost: rec.serviceRecommendation.estimatedCost,
      });
    });

  // Sort by priority
  actionPlan.sort((a, b) => a.priority - b.priority);

  return actionPlan.slice(0, 10); // Limit to top 10 items
}