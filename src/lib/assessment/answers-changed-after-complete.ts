import "server-only";

import { prisma } from "@/lib/db";
import { safeDecryptAnswer } from "@/lib/data/response-content";
import { emitAssessmentAnswersChangedSignal } from "@/lib/signals/emit";

export function stableAssessmentAnswerJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function assessmentStoredAnswerChanged(input: {
  priorSkipped: boolean;
  priorAnswer: unknown;
  nextSkipped: boolean;
  nextAnswer: unknown;
}): boolean {
  if (input.priorSkipped !== input.nextSkipped) {
    return true;
  }
  if (input.nextSkipped) {
    return false;
  }
  return (
    stableAssessmentAnswerJson(input.priorAnswer) !==
    stableAssessmentAnswerJson(input.nextAnswer)
  );
}

export function assessmentNeedsRescore(input: {
  status: string;
  answersChangedAfterCompleteAt: Date | null;
}): boolean {
  return (
    input.status === "COMPLETED" && input.answersChangedAfterCompleteAt != null
  );
}

/**
 * After a material answer change on a completed assessment, stamp the
 * assessment and notify assigned advisors (coalesced signal per assessment).
 */
export async function markAssessmentAnswersChangedAfterComplete(
  assessmentId: string,
): Promise<void> {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: {
      id: true,
      userId: true,
      status: true,
      version: true,
      answersChangedAfterCompleteAt: true,
    },
  });

  if (!assessment || assessment.status !== "COMPLETED") {
    return;
  }

  const changedAt = new Date();
  await prisma.assessment.update({
    where: { id: assessmentId },
    data: { answersChangedAfterCompleteAt: changedAt },
  });

  void emitAssessmentAnswersChangedSignal({
    clientId: assessment.userId,
    assessmentId: assessment.id,
    version: assessment.version,
    changedAt,
  });
}

export async function loadPriorAssessmentAnswer(
  assessmentId: string,
  questionId: string,
): Promise<{ skipped: boolean; answer: unknown } | null> {
  const row = await prisma.assessmentResponse.findUnique({
    where: {
      assessmentId_questionId: { assessmentId, questionId },
    },
    select: { skipped: true, answer: true, id: true },
  });

  if (!row) {
    return null;
  }

  return {
    skipped: row.skipped,
    answer: safeDecryptAnswer(row.answer as string | null, {
      rowId: row.id,
      column: "AssessmentResponse.answer",
    }),
  };
}
