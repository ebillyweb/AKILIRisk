/**
 * Assessment Submission API
 * POST /api/assessment/enhanced/submit
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma, RiskLevel } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { EnhancedScoringEngine } from '@/lib/assessment/engines/enhanced-scoring-engine';
import { RecommendationEngine } from '@/lib/assessment/engines/recommendation-engine';
import { RuleEngine } from '@/lib/assessment/engines/rule-engine';
import { loadGovernanceQuestionsMerged } from '@/lib/assessment/bank/load-bank';
import { encryptAnswer } from '@/lib/data/response-content';
import { resolveRecommendationRulesForAssessment } from '@/lib/methodology/assessment-runtime';
import { z } from 'zod';

function parseRiskLevel(value: string): RiskLevel {
  const v = value.toUpperCase();
  if (v === 'LOW' || v === 'MEDIUM' || v === 'HIGH' || v === 'CRITICAL') {
    return v;
  }
  return RiskLevel.MEDIUM;
}

const SubmitAssessmentSchema = z.object({
  assessmentId: z.string(),
  answers: z.record(z.string(), z.unknown()),
  pillarId: z.string().optional(),
  visibleQuestionIds: z.array(z.string()).optional(),
  complete: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = SubmitAssessmentSchema.parse(body);

    // Verify assessment ownership
    const assessment = await prisma.assessment.findFirst({
      where: {
        id: validatedData.assessmentId,
        userId: session.user.id,
      }
    });

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 });
    }

    // Begin transaction for atomic updates
    const result = await prisma.$transaction(async (tx) => {
      // Round-11 commit 2.5b: only the encrypted answer is persisted.
      // The renamed `answer` column now holds ciphertext.
      const answerUpdates = Object.entries(validatedData.answers).map(([questionId, answer]) => ({
        assessmentId: validatedData.assessmentId,
        questionId,
        pillar: validatedData.pillarId || 'unknown',
        subCategory: 'default', // This would need to be determined from question
        answer: encryptAnswer(answer),
        skipped: false,
      }));

      for (const answerData of answerUpdates) {
        await tx.assessmentResponse.upsert({
          where: {
            assessmentId_questionId: {
              assessmentId: validatedData.assessmentId,
              questionId: answerData.questionId,
            }
          },
          create: answerData,
          update: {
            answer: answerData.answer,
            skipped: answerData.skipped,
            updatedAt: new Date(),
          },
        });
      }

      // If this is a pillar completion, calculate scores
      let pillarScore = null;
      let recommendations = null;

      if (validatedData.pillarId) {
        // Load questions for this pillar
        const questions = await loadGovernanceQuestionsMerged({
          onlyVisible: true,
          riskAreaId: validatedData.pillarId
        });

        // Calculate enhanced scores
        const scoringEngine = new EnhancedScoringEngine();
        const scoreResult = await scoringEngine.calculateAdvancedPillarScore({
          answers: validatedData.answers,
          householdProfile: null, // This would be loaded from user profile
          assessmentId: validatedData.assessmentId,
          pillarId: validatedData.pillarId
        }, questions);

        // Save pillar score
        pillarScore = await tx.pillarScore.upsert({
          where: {
            assessmentId_pillar: {
              assessmentId: validatedData.assessmentId,
              pillar: validatedData.pillarId,
            }
          },
          create: {
            assessmentId: validatedData.assessmentId,
            pillar: validatedData.pillarId,
            score: scoreResult.score,
            riskLevel: parseRiskLevel(scoreResult.riskLevel),
            breakdown: scoreResult.breakdown as unknown as Prisma.InputJsonValue,
            missingControls: scoreResult.missingControls as unknown as Prisma.InputJsonValue,
          },
          update: {
            score: scoreResult.score,
            riskLevel: parseRiskLevel(scoreResult.riskLevel),
            breakdown: scoreResult.breakdown as unknown as Prisma.InputJsonValue,
            missingControls: scoreResult.missingControls as unknown as Prisma.InputJsonValue,
            calculatedAt: new Date(),
          },
        });

        // Generate recommendations for this pillar
        const recommendationEngine = new RecommendationEngine();
        const pillarScores = { [validatedData.pillarId]: { score: scoreResult.score, riskLevel: scoreResult.riskLevel } };

        const rulesOverride = await resolveRecommendationRulesForAssessment(validatedData.assessmentId);

        recommendations = await recommendationEngine.generateRecommendations(
          {
            assessmentId: validatedData.assessmentId,
            userId: session.user.id!,
            pillarScores,
            answers: validatedData.answers,
            householdProfile: null, // This would be loaded from user profile
            missingControls: scoreResult.missingControls,
          },
          rulesOverride,
        );
      }

      // Update assessment status if complete
      if (validatedData.complete) {
        await tx.assessment.update({
          where: { id: validatedData.assessmentId },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });
      }

      return {
        pillarScore,
        recommendations,
        answersUpdated: answerUpdates.length,
      };
    });

    return NextResponse.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('Error submitting assessment:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to submit assessment' },
      { status: 500 }
    );
  }
}