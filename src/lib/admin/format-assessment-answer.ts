import type { QuestionReviewContext } from "@/lib/assessment/question-review-context";
import { MATURITY_LEVEL_LABELS } from "@/lib/assessment/governance-rubric";

/** Read-only label for admin answer review (does not affect scoring). */
export function formatAssessmentAnswerForDisplay(
  question: Pick<QuestionReviewContext, "type" | "options"> | undefined,
  answer: unknown,
  skipped: boolean
): string {
  if (skipped) return "Skipped";
  if (answer === null || answer === undefined) return "No answer recorded";

  if (question?.type === "maturity-scale" && typeof answer === "number") {
    const label = MATURITY_LEVEL_LABELS[answer];
    return label ? `${answer} — ${label}` : String(answer);
  }

  if (question?.type === "likert" && (typeof answer === "number" || typeof answer === "string")) {
    return String(answer);
  }

  if (question?.options?.length) {
    const match = question.options.find(
      (o) => o.value === answer || String(o.value) === String(answer)
    );
    if (match?.label) return match.label;
  }

  if (typeof answer === "boolean") return answer ? "Yes" : "No";
  if (Array.isArray(answer)) return answer.map(String).join(", ");
  if (typeof answer === "object") return JSON.stringify(answer, null, 2);

  return String(answer);
}
