import { ADVISOR_ASSESSMENT_ANSWER_TYPES } from "@/lib/methodology/advisor-assessment-question-config";

/** Intake questions share assessment answer types; freeform types allow audio/typed responses. */
export function intakeUsesFreeformResponse(answerType: string): boolean {
  return answerType === "fillable" || answerType === "audio" || !answerType;
}

export function normalizeIntakeAnswerType(answerType: string | null | undefined): string {
  if (answerType && ADVISOR_ASSESSMENT_ANSWER_TYPES.includes(answerType as never)) {
    return answerType;
  }
  if (answerType === "audio") return "fillable";
  return "fillable";
}

export function intakeChoiceOptions(question: {
  answerType: string;
  answer0?: string | null;
  answer1?: string | null;
  answer2?: string | null;
  answer3?: string | null;
}): Array<{ value: string; label: string }> {
  const clean = (value: string | null | undefined, fallback: string) => {
    const trimmed = value?.trim();
    return trimmed || fallback;
  };

  switch (question.answerType) {
    case "yes_no":
      return [
        { value: "yes", label: clean(question.answer1, "Yes") },
        { value: "no", label: clean(question.answer0, "No") },
      ];
    case "likert_5":
      return ["1", "2", "3", "4", "5"].map((value) => ({ value, label: value }));
    case "scale_1_5":
      return ["1", "2", "3", "4", "5"].map((value, index) => ({
        value,
        label: [question.answer0, question.answer1, question.answer2, question.answer3, "5"][
          index
        ]?.trim() || value,
      }));
    case "scored_0_3":
      return ["0", "1", "2", "3"].map((value, index) => ({
        value,
        label: [question.answer0, question.answer1, question.answer2, question.answer3][index]?.trim() ||
          value,
      }));
    default:
      return [];
  }
}
