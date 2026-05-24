import { prisma } from "@/lib/db";
import { safeDecryptAnswer } from "@/lib/data/response-content";

/** Load decrypted assessment answers for the given question ids. */
export async function loadAssessmentAnswersForQuestions(
  assessmentId: string,
  questionIds: string[]
): Promise<Record<string, unknown>> {
  if (questionIds.length === 0) {
    return {};
  }

  const responses = await prisma.assessmentResponse.findMany({
    where: {
      assessmentId,
      skipped: false,
      questionId: { in: questionIds },
    },
  });

  const answers: Record<string, unknown> = {};
  for (const response of responses) {
    answers[response.questionId] = safeDecryptAnswer(
      response.answer as unknown as string | null,
      { rowId: response.questionId, column: "AssessmentResponse.answer" }
    );
  }

  return answers;
}
