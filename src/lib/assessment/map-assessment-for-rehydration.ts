import { safeDecryptAnswer } from "@/lib/data/response-content";
import type { ServerAssessmentData } from "@/lib/assessment/store";

type RawAssessmentResponse = {
  questionId: string;
  answer: unknown;
  skipped: boolean;
  id?: string;
};

export function mapResponseForRehydration(
  response: RawAssessmentResponse,
): ServerAssessmentData["responses"][number] {
  return {
    questionId: response.questionId,
    skipped: response.skipped,
    answer: response.skipped
      ? null
      : safeDecryptAnswer(response.answer as string | null, {
          rowId: response.id ?? response.questionId,
          column: "AssessmentResponse.answer",
        }),
  };
}

export function mapAssessmentForRehydration<T extends { responses: RawAssessmentResponse[] }>(
  assessment: T,
): Omit<T, "responses"> & { responses: ServerAssessmentData["responses"] } {
  return {
    ...assessment,
    responses: assessment.responses.map(mapResponseForRehydration),
  };
}
