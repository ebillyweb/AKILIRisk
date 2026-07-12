/**
 * Presentation helpers for question-bank UIs (admin / advisor).
 * Keeps internal IDs and probe markers out of end-user-facing copy.
 */

/** Remove trailing bracket tags (e.g. `[pw-123]`) used as internal references. */
export function formatQuestionTextForDisplay(text: string): string {
  return text.replace(/\s*\[[^\]]{1,64}\]\s*$/u, "").trim();
}

export type AnswerOptionField = {
  name: "answer0" | "answer1" | "answer2" | "answer3";
  label: string;
  defaultValue: string;
};

/** Human labels for maturity / choice answer fields (edit & create forms). */
export function getAnswerOptionFields(
  answerType: string,
  defaults: { answer0: string; answer1: string; answer2: string; answer3: string }
): AnswerOptionField[] {
  const fields: AnswerOptionField[] = [
    { name: "answer0", label: "", defaultValue: defaults.answer0 },
    { name: "answer1", label: "", defaultValue: defaults.answer1 },
    { name: "answer2", label: "", defaultValue: defaults.answer2 },
    { name: "answer3", label: "", defaultValue: defaults.answer3 },
  ];

  switch (answerType) {
    case "scored_0_3":
      fields[0].label = "Lowest maturity (score 0)";
      fields[1].label = "Maturity level 1";
      fields[2].label = "Maturity level 2";
      fields[3].label = "Highest maturity (score 3)";
      return fields;
    case "yes_no":
      fields[0].label = "No";
      fields[1].label = "Yes";
      return fields.slice(0, 2);
    case "likert_5":
    case "scale_1_5":
      fields[0].label = "Strongly disagree";
      fields[1].label = "Disagree";
      fields[2].label = "Neutral";
      fields[3].label = "Agree";
      return fields;
    case "multi_select":
      fields[0].label = "Option 1";
      fields[1].label = "Option 2";
      fields[2].label = "Option 3 (optional)";
      fields[3].label = "Option 4 (optional)";
      return fields;
    case "fillable":
    case "number":
    case "date_mm_yyyy":
      return [];
    default:
      fields[0].label = "First option";
      fields[1].label = "Second option";
      fields[2].label = "Third option";
      fields[3].label = "Fourth option";
      return fields;
  }
}
