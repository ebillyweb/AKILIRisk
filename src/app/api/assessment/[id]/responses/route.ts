import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encryptAnswer, safeDecryptAnswer } from "@/lib/data/response-content";
import {
  assessmentStoredAnswerChanged,
  loadPriorAssessmentAnswer,
  markAssessmentAnswersChangedAfterComplete,
} from "@/lib/assessment/answers-changed-after-complete";
import { isPillarInAssessmentScope } from "@/lib/assessment/included-pillars";

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
  orphanedQuestionIds: z.array(z.string()).optional(),
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

    const { questionId, pillar, subCategory, answer, skipped, currentQuestionIndex, orphanedQuestionIds } =
      validation.data;

    // Verify ownership
    const assessment = await prisma.assessment.findUnique({
      where: { id },
      select: { userId: true, status: true, includedPillars: true },
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

    if (!isPillarInAssessmentScope(pillar, assessment.includedPillars)) {
      return NextResponse.json(
        {
          error: "This pillar is not included in your assessment scope.",
          code: "PILLAR_OUT_OF_SCOPE",
        },
        { status: 400 },
      );
    }

    // Round-11 commit 2.5b: only the encrypted answer is persisted.
    // The plaintext `answer Json` column was dropped; the renamed
    // `answer` column now holds ciphertext as `String?` in the new
    // schema. Once the Prisma client is regenerated post-migration
    // the type-cast that used to live here is no longer needed.
    //
    // Round-11 cleanup: explicit guard for missing `answer` when the
    // response isn't marked as skipped. `saveResponseSchema.answer` is
    // `z.unknown()` which accepts `undefined`, and
    // `JSON.stringify(undefined)` returns the JS value `undefined` —
    // letting it through would surface as an opaque 500 from the AES
    // cipher. Reject up front with a clear 400.
    const isSkipped = skipped === true;
    if (!isSkipped && typeof answer === "undefined") {
      return NextResponse.json(
        { error: "answer is required when skipped is false" },
        { status: 400 }
      );
    }
    const answerCiphertext = isSkipped ? null : encryptAnswer(answer);

    const priorAnswer =
      assessment.status === "COMPLETED"
        ? await loadPriorAssessmentAnswer(id, questionId)
        : null;
    const answerChangedAfterComplete =
      assessment.status === "COMPLETED" &&
      assessmentStoredAnswerChanged({
        priorSkipped: priorAnswer?.skipped ?? false,
        priorAnswer: priorAnswer?.answer,
        nextSkipped: isSkipped,
        nextAnswer: isSkipped ? null : answer,
      });

    // Upsert response and update assessment position in a transaction
    const [response] = await prisma.$transaction(async (tx) => {
      if (orphanedQuestionIds && orphanedQuestionIds.length > 0) {
        await tx.assessmentResponse.deleteMany({
          where: {
            assessmentId: id,
            questionId: { in: orphanedQuestionIds },
          },
        });
      }

      const saved = await tx.assessmentResponse.upsert({
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
      });

      await tx.assessment.update({
        where: { id },
        data: {
          currentPillar: pillar,
          currentQuestionIndex: currentQuestionIndex ?? undefined,
          updatedAt: new Date(),
        },
      });

      return [saved];
    });

    if (answerChangedAfterComplete) {
      void markAssessmentAnswersChangedAfterComplete(id);
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Error saving response:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
