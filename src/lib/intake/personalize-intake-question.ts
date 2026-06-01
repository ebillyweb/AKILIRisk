import type { IntakeQuestion } from "@/lib/intake/types";

const LEGACY_FIRM_NAME_PATTERN =
  /\bat (Belvedere Risk Management|Belvedere|AKILI)\b/gi;

/** Replace `{{firmName}}` and legacy hardcoded platform names in intake copy. */
export function personalizeIntakeQuestionText(
  text: string,
  firmName: string | null | undefined
): string {
  const label = firmName?.trim() || "your advisor";
  return text
    .replaceAll("{{firmName}}", label)
    .replace(LEGACY_FIRM_NAME_PATTERN, `at ${label}`);
}

export function personalizeIntakeQuestion(
  question: IntakeQuestion,
  firmName: string | null | undefined
): IntakeQuestion {
  return {
    ...question,
    questionText: personalizeIntakeQuestionText(question.questionText, firmName),
    whyThisMatters: question.whyThisMatters
      ? personalizeIntakeQuestionText(question.whyThisMatters, firmName)
      : undefined,
    context: personalizeIntakeQuestionText(question.context, firmName),
  };
}

export function personalizeIntakeScript(
  questions: IntakeQuestion[],
  firmName: string | null | undefined
): IntakeQuestion[] {
  return questions.map((question) => personalizeIntakeQuestion(question, firmName));
}
