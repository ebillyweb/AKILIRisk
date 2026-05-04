import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

/**
 * Assessment Responses API Routes
 *
 * GET: Load all responses for an assessment
 * POST: Save/upsert a response
 */

const saveResponseSchema = z.object({
  questionId: z.string(),
  pillar: z.string(),
  subCategory: z.string(),
  answer: z.unknown(),
  skipped: z.boolean().optional(),
  currentQuestionIndex: z.number().optional(),
});

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

    // Return 404 (not 403) so the response shape doesn't distinguish
    // "no such assessment" from "exists but not yours."
    if (assessment.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 }
      );
    }

    const responses = await prisma.assessmentResponse.findMany({
      where: {
        assessmentId: id,
      },
      orderBy: {
        answeredAt: "asc",
      },
    });

    return NextResponse.json(responses);
  } catch (error) {
    console.error("Error fetching responses:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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
    const body = await request.json();

    const validation = saveResponseSchema.safeParse(body);

    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { questionId, pillar, subCategory, answer, skipped, currentQuestionIndex } = validation.data;

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

    // Return 404 (not 403) so the response shape doesn't distinguish
    // "no such assessment" from "exists but not yours."
    if (assessment.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 }
      );
    }

    // Upsert response and update assessment position in a transaction
    const [response] = await prisma.$transaction([
      prisma.assessmentResponse.upsert({
        where: {
          assessmentId_questionId: {
            assessmentId: id,
            questionId,
          },
        },
        create: {
          assessmentId: id,
          questionId,
          pillar,
          subCategory,
          answer: answer as Prisma.InputJsonValue,
          skipped: skipped ?? false,
        },
        update: {
          answer: answer as Prisma.InputJsonValue,
          skipped: skipped ?? false,
          updatedAt: new Date(),
        },
      }),
      prisma.assessment.update({
        where: { id },
        data: {
          currentPillar: pillar,
          currentQuestionIndex: currentQuestionIndex ?? undefined,
          updatedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Error saving response:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
