import type { QuestionReviewContext } from "@/lib/assessment/question-review-context";
import { MATURITY_LEVEL_LABELS } from "@/lib/assessment/governance-rubric";
import {
  normalizeAssessmentDocumentUploadAnswer,
} from "@/lib/assessment/question-upload";
import {
  formatDateAnswerForDisplay,
  formatMonthYearAnswerForDisplay,
  isIsoDateAnswer,
  isIsoMonthYearAnswer,
} from "@/lib/assessment/question-date";

/** Read-only label for admin answer review (does not affect scoring). */
export function formatAssessmentAnswerForDisplay(
  question: Pick<QuestionReviewContext, "type" | "options"> | undefined,
  answer: unknown,
  skipped: boolean
): string {
  if (skipped) {
    if (question?.type === "document-upload") {
      return "No documents attached — client continued without upload";
    }
    return "Skipped";
  }
  if (answer === null || answer === undefined) return "No answer recorded";

  const uploadedFiles = normalizeAssessmentDocumentUploadAnswer(answer);
  if (uploadedFiles.length > 0) {
    if (uploadedFiles.length === 1) {
      return `Uploaded: ${uploadedFiles[0]!.fileName}`;
    }
    return `Uploaded ${uploadedFiles.length} documents: ${uploadedFiles.map((f) => f.fileName).join(", ")}`;
  }

  if (question?.type === "date" && isIsoDateAnswer(answer)) {
    return formatDateAnswerForDisplay(answer);
  }

  if (question?.type === "month-year" && isIsoMonthYearAnswer(answer)) {
    return formatMonthYearAnswerForDisplay(answer);
  }

  if (question?.type === "multi-choice" && Array.isArray(answer)) {
    if (answer.length === 0) return "No answer recorded";
    return answer
      .map((selected) => {
        const match = question.options?.find(
          (o) => o.value === selected || String(o.value) === String(selected)
        );
        return match?.label ?? String(selected);
      })
      .join(", ");
  }

  if (question?.options?.length) {
    const match = question.options.find(
      (o) => o.value === answer || String(o.value) === String(answer)
    );
    if (match?.label) return match.label;
  }

  if (question?.type === "maturity-scale" && typeof answer === "number") {
    const label = MATURITY_LEVEL_LABELS[answer];
    return label ? `${answer} — ${label}` : String(answer);
  }

  if (question?.type === "likert" && (typeof answer === "number" || typeof answer === "string")) {
    return String(answer);
  }

  if (typeof answer === "boolean") return answer ? "Yes" : "No";
  if (Array.isArray(answer)) return answer.map(String).join(", ");
  if (typeof answer === "object") return JSON.stringify(answer, null, 2);

  return String(answer);
}
