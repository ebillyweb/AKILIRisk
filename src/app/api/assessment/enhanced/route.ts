/**
 * Enhanced Assessment API Routes
 *
 * Comprehensive API endpoints for the enhanced assessment system
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { EnhancedScoringEngine } from '@/lib/assessment/engines/enhanced-scoring-engine';
import { RecommendationEngine } from '@/lib/assessment/engines/recommendation-engine';
import { RuleEngine } from '@/lib/assessment/engines/rule-engine';
import { loadGovernanceQuestionsMerged } from '@/lib/assessment/bank/load-bank';
import { z } from 'zod';

// Validation schemas
const SubmitAssessmentSchema = z.object({
  assessmentId: z.string(),
  answers: z.record(z.string(), z.unknown()),
  pillarId: z.string().optional(),
  visibleQuestionIds: z.array(z.string()).optional(),
});

const CreateAssessmentSchema = z.object({
  userId: z.string(),
  version: z.number().default(1),
  focusAreas: z.array(z.string()).optional(),
});

/**
 * GET /api/assessment/enhanced/pillars
 * Retrieve all pillars with their subcategories and question counts
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const pillarId = url.searchParams.get('pillarId');

    if (pillarId) {
      // Get specific pillar details
      const questions = await loadGovernanceQuestionsMerged({
        onlyVisible: true,
        riskAreaId: pillarId
      });

      const pillarConfig = await prisma.pillarConfiguration.findUnique({
        where: { pillarId, isActive: true }
      });

      const subCategories = await prisma.subCategoryConfiguration.findMany({
        where: { pillarId, isActive: true },
        orderBy: { sortOrder: 'asc' }
      });

      return NextResponse.json({
        pillar: pillarConfig,
        subCategories,
        questions,
        questionCount: questions.length
      });
    } else {
      // Get all pillars overview
      const pillars = await prisma.pillarConfiguration.findMany({
        where: { isActive: true },
        orderBy: { id: 'asc' }
      });

      const pillarOverview = await Promise.all(
        pillars.map(async (pillar) => {
          const questionCount = await prisma.assessmentBankQuestion.count({
            where: { riskAreaId: pillar.pillarId, isVisible: true }
          });

          const subCategories = await prisma.subCategoryConfiguration.findMany({
            where: { pillarId: pillar.pillarId, isActive: true },
            orderBy: { sortOrder: 'asc' }
          });

          return {
            ...pillar,
            questionCount,
            subCategoryCount: subCategories.length
          };
        })
      );

      return NextResponse.json({ pillars: pillarOverview });
    }
  } catch (error) {
    console.error('Error fetching pillars:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pillars' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/assessment/enhanced/create
 * Create a new assessment
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = CreateAssessmentSchema.parse(body);

    const assessment = await prisma.assessment.create({
      data: {
        userId: validatedData.userId,
        version: validatedData.version,
        status: 'IN_PROGRESS',
        currentPillar: null,
        currentQuestionIndex: 0,
      }
    });

    return NextResponse.json({ assessment });
  } catch (error) {
    console.error('Error creating assessment:', error);
    return NextResponse.json(
      { error: 'Failed to create assessment' },
      { status: 500 }
    );
  }
}