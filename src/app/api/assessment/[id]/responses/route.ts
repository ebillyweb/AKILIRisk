import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encryptAnswer, safeDecryptAnswer } from "@/lib/data/response-content";

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

    const rows = await prisma.assessmentResponse.findMany({
      where: {
        assessmentId: id,
      },
      orderBy: {
        answeredAt: "asc",
      },
    });

    // Round-11 commit 2.5b: decrypt the answer column at the API
    // layer so the assessment client form sees plaintext JSON values.
    // Round-11 cleanup: tamper-resilient decrypt — corrupted rows
    // surface as { answer: null } instead of crashing the request.
    const responses = rows.map((r) => ({
      ...r,
      answer: safeDecryptAnswer(r.answer as unknown as string | null, {
        rowId: r.id,
        column: "AssessmentResponse.answer",
      }),
    }));

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

    // Round-11 commit 2.5b: only the encrypted answer is persisted.
    // The plaintext `answer Json` column was dropped; the renamed
    // `answer` column now holds ciphertext (typed as `String?` in
    // the new schema). Cast through Prisma's InputJsonValue so the
    // cached generated client (which still types `answer` as
    // JsonValue) accepts a string write.
    const answerCiphertext =
      skipped === true ? null : encryptAnswer(answer);

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
          answer: answerCiphertext,
          skipped: skipped ?? false,
        },
        update: {
          answer: answerCiphertext,
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
