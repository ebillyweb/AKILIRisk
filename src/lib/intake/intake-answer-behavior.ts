import { ADVISOR_INTAKE_ANSWER_TYPES } from "@/lib/methodology/advisor-intake-question-config";
import {
  parseStoredIntakeChoiceListOptions,
  resolveIntakeChoiceListLabel,
} from "@/lib/intake/choice-list-options";
import type { IntakeChoiceListOption } from "@/lib/intake/choice-list-options";
import {
  formatMultiSelectForDisplay,
  formatPropertyListForDisplay,
} from "@/lib/intake/structured-answer-values";

/** Intake questions share assessment answer types; freeform types allow audio/typed responses. */
export function intakeUsesFreeformResponse(answerType: string): boolean {
  return answerType === "fillable" || answerType === "audio" || !answerType;
}

export function normalizeIntakeAnswerType(answerType: string | null | undefined): string {
  if (answerType && ADVISOR_INTAKE_ANSWER_TYPES.includes(answerType as never)) {
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
  options?: IntakeChoiceListOption[] | unknown | null;
}): Array<{ value: string; label: string }> {
  const clean = (value: string | null | undefined, fallback: string) => {
    const trimmed = value?.trim();
    return trimmed || fallback;
  };

  switch (question.answerType) {
    case "choice_list":
    case "multi_select":
      return parseStoredIntakeChoiceListOptions(question.options);
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

/** Map a stored structured answer value to a human-readable label when possible. */
export function formatIntakeStructuredAnswerForDisplay(
  question: {
    answerType: string;
    answer0?: string | null;
    answer1?: string | null;
    answer2?: string | null;
    answer3?: string | null;
    options?: IntakeChoiceListOption[] | unknown | null;
  },
  storedValue: string | null | undefined,
): string | null {
  const value = storedValue?.trim();
  if (!value) return null;

  if (question.answerType === "choice_list") {
    const options = parseStoredIntakeChoiceListOptions(question.options);
    return resolveIntakeChoiceListLabel(options, value) ?? value;
  }

  if (question.answerType === "multi_select") {
    const options = parseStoredIntakeChoiceListOptions(question.options);
    return formatMultiSelectForDisplay(options, value);
  }

  if (question.answerType === "property_list") {
    return formatPropertyListForDisplay(value);
  }

  const match = intakeChoiceOptions(question).find((choice) => choice.value === value);
  return match?.label ?? value;
}
