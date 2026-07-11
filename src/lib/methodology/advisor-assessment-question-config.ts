import { z } from "zod";

import type { GovernanceQuestionWire } from "@/lib/assessment/bank/behaviors";
import { isDocumentUploadFillableQuestionText } from "@/lib/assessment/question-upload";
import { isDateQuestionText } from "@/lib/assessment/question-date";

export const ADVISOR_ASSESSMENT_ANSWER_TYPES = [
  "scored_0_3",
  "yes_no",
  "likert_5",
  "scale_1_5",
  "multi_select",
  "fillable",
  "number",
  "date",
  "date_mm_yyyy",
] as const;

export type AdvisorAssessmentAnswerType = (typeof ADVISOR_ASSESSMENT_ANSWER_TYPES)[number];

export const ADVISOR_ASSESSMENT_ANSWER_TYPE_OPTIONS: ReadonlyArray<{
  value: AdvisorAssessmentAnswerType;
  label: string;
}> = [
  { value: "scored_0_3", label: "Maturity scale (0–3)" },
  { value: "yes_no", label: "Yes / No" },
  { value: "likert_5", label: "Likert (1–5)" },
  { value: "scale_1_5", label: "Scale 1–5 (single choice)" },
  { value: "multi_select", label: "Select all that apply (multi-choice)" },
  { value: "fillable", label: "Short text" },
  { value: "number", label: "Numeric" },
  { value: "date", label: "Date (calendar)" },
  { value: "date_mm_yyyy", label: "Date (MM/YYYY)" },
];

const optionalAnswerLabel = z
  .string()
  .max(500)
  .optional()
  .nullable()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  });

export const advisorAssessmentQuestionInputSchema = z.object({
  questionText: z.string().trim().min(1, "Question text is required"),
  whyThisMatters: optionalAnswerLabel,
  recommendedActions: optionalAnswerLabel,
  answerType: z.enum(ADVISOR_ASSESSMENT_ANSWER_TYPES),
  answer0: optionalAnswerLabel,
  answer1: optionalAnswerLabel,
  answer2: optionalAnswerLabel,
  answer3: optionalAnswerLabel,
  isVisible: z.boolean().optional(),
});

export type AdvisorAssessmentQuestionInput = z.infer<typeof advisorAssessmentQuestionInputSchema>;

export type AdvisorAssessmentQuestionRow = {
  id: string;
  displayOrder: number;
  questionText: string;
  answerType: string;
  scoreMap: unknown;
  answer0: string | null;
  answer1: string | null;
  answer2: string | null;
  answer3: string | null;
  whyThisMatters: string | null;
  recommendedActions: string | null;
  pillarSlug: string;
};

function cleanLabel(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

export function defaultScoreMapForAnswerType(
  answerType: AdvisorAssessmentAnswerType,
): Record<string, number> {
  switch (answerType) {
    case "yes_no":
      return { yes: 3, no: 0 };
    case "likert_5":
    case "scale_1_5":
      return { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5 };
    case "multi_select":
    case "fillable":
    case "number":
    case "date":
    case "date_mm_yyyy":
      return {};
    case "scored_0_3":
    default:
      return { "0": 0, "1": 1, "2": 2, "3": 3 };
  }
}

export function parseAdvisorAssessmentQuestionInput(
  data: unknown,
):
  | { success: true; data: AdvisorAssessmentQuestionInput }
  | { success: false; error: string } {
  const parsed = advisorAssessmentQuestionInputSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid question data",
    };
  }
  return { success: true, data: parsed.data };
}

function answerLabelWriteFields(
  input: Pick<AdvisorAssessmentQuestionInput, "answer0" | "answer1" | "answer2" | "answer3">,
): Partial<
  Pick<AdvisorAssessmentQuestionInput, "answer0" | "answer1" | "answer2" | "answer3">
> {
  const hasAnyLabel = [input.answer0, input.answer1, input.answer2, input.answer3].some(
    (value) => value?.trim(),
  );
  if (!hasAnyLabel) {
    return {};
  }

  return {
    answer0: input.answer0,
    answer1: input.answer1,
    answer2: input.answer2,
    answer3: input.answer3,
  };
}

export function buildAdvisorAssessmentQuestionWriteData(input: AdvisorAssessmentQuestionInput) {
  return {
    questionText: input.questionText,
    whyThisMatters: input.whyThisMatters,
    recommendedActions: input.recommendedActions,
    answerType: input.answerType,
    scoreMap: defaultScoreMapForAnswerType(input.answerType),
    ...answerLabelWriteFields(input),
    ...(input.isVisible !== undefined ? { isVisible: input.isVisible } : {}),
  };
}

export function labelForAdvisorAssessmentAnswerType(answerType: string): string {
  return (
    ADVISOR_ASSESSMENT_ANSWER_TYPE_OPTIONS.find((option) => option.value === answerType)?.label ??
    answerType
  );
}

export function advisorAssessmentQuestionToWire(
  row: AdvisorAssessmentQuestionRow,
): GovernanceQuestionWire {
  const base = {
    questionId: row.id,
    riskAreaId: row.pillarSlug,
    sortOrderGlobal: row.displayOrder,
    text: row.questionText,
    helpText: row.whyThisMatters,
    learnMore: row.recommendedActions,
    riskRelevance: row.whyThisMatters,
    required: true,
    weight: 2,
    branchingDependsOn: null,
    branchingPredicate: null,
    profileConditionKey: null,
    omitMaturityScoreWhenYes: false,
  };

  const scoreMap =
    row.scoreMap && typeof row.scoreMap === "object" && !Array.isArray(row.scoreMap)
      ? (row.scoreMap as Record<string, number>)
      : defaultScoreMapForAnswerType(
          (ADVISOR_ASSESSMENT_ANSWER_TYPES.includes(row.answerType as AdvisorAssessmentAnswerType)
            ? row.answerType
            : "scored_0_3") as AdvisorAssessmentAnswerType,
        );

  switch (row.answerType) {
    case "yes_no":
      return {
        ...base,
        type: "yes-no",
        options: [
          { value: "yes", label: cleanLabel(row.answer1, "Yes") },
          { value: "no", label: cleanLabel(row.answer0, "No") },
        ],
        scoreMap,
      };
    case "likert_5":
      return {
        ...base,
        type: "likert",
        options: null,
        scoreMap,
      };
    case "scale_1_5": {
      const labels = [
        cleanLabel(row.answer0, "1"),
        cleanLabel(row.answer1, "2"),
        cleanLabel(row.answer2, "3"),
        cleanLabel(row.answer3, "4–5"),
      ];
      return {
        ...base,
        type: "single-choice",
        options: [1, 2, 3, 4, 5].map((value, index) => ({
          value: String(value),
          label: String(value),
          description: labels[Math.min(index, labels.length - 1)] ?? String(value),
        })),
        scoreMap,
      };
    }
    case "multi_select": {
      // answer0–answer3 double as the selectable options; the stored answer is
      // a JSON array of the selected labels. Informational (empty scoreMap), so
      // it is excluded from the maturity rollup like fillable/number/date.
      const options = [row.answer0, row.answer1, row.answer2, row.answer3]
        .map((label) => (label ?? "").trim())
        .filter((label) => label.length > 0)
        .map((label) => ({ value: label, label }));
      return {
        ...base,
        type: "multi-choice",
        options,
        weight: 1,
        scoreMap: {},
      };
    }
    case "fillable": {
      const isDocumentUpload = isDocumentUploadFillableQuestionText(row.questionText);
      const isDate = !isDocumentUpload && isDateQuestionText(row.questionText);
      return {
        ...base,
        type: isDocumentUpload ? "document-upload" : isDate ? "date" : "short-text",
        options: null,
        required: !isDocumentUpload,
        weight: 1,
        scoreMap: {},
      };
    }
    case "number":
      return {
        ...base,
        type: "numeric",
        options: null,
        weight: 1,
        scoreMap: {},
      };
    case "date":
      return {
        ...base,
        type: "date",
        options: null,
        weight: 1,
        scoreMap: {},
      };
    case "date_mm_yyyy":
      return {
        ...base,
        type: "month-year",
        helpText: row.whyThisMatters ?? "Select the month and year.",
        options: null,
        weight: 1,
        scoreMap: {},
      };
    case "scored_0_3":
    default: {
      const a0 = cleanLabel(row.answer0, "0");
      const a1 = cleanLabel(row.answer1, "1");
      const a2 = cleanLabel(row.answer2, "2");
      const a3 = cleanLabel(row.answer3, "3");
      return {
        ...base,
        type: "maturity-scale",
        options: [0, 1, 2, 3].map((value) => ({
          value,
          label: [a0, a1, a2, a3][value] ?? `Level ${value}`,
        })),
        scoreMap,
      };
    }
  }
}

export function readAdvisorAssessmentQuestionForm(formData: FormData) {
  return {
    questionText: formData.get("questionText")?.toString() ?? "",
    whyThisMatters: formData.get("whyThisMatters")?.toString() ?? null,
    recommendedActions: formData.get("recommendedActions")?.toString() ?? null,
    answerType: formData.get("answerType")?.toString() ?? "scored_0_3",
    answer0: formData.get("answer0")?.toString() ?? null,
    answer1: formData.get("answer1")?.toString() ?? null,
    answer2: formData.get("answer2")?.toString() ?? null,
    answer3: formData.get("answer3")?.toString() ?? null,
  };
}
