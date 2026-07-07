import { z } from "zod";
import { Prisma } from "@prisma/client";

import {
  ADVISOR_ASSESSMENT_ANSWER_TYPE_OPTIONS,
  ADVISOR_ASSESSMENT_ANSWER_TYPES,
  advisorAssessmentQuestionInputSchema,
  buildAdvisorAssessmentQuestionWriteData,
  labelForAdvisorAssessmentAnswerType,
  parseAdvisorAssessmentQuestionInput,
  readAdvisorAssessmentQuestionForm,
  type AdvisorAssessmentAnswerType,
  type AdvisorAssessmentQuestionInput,
} from "@/lib/methodology/advisor-assessment-question-config";
import {
  INTAKE_CHOICE_LIST_MAX,
  INTAKE_CHOICE_LIST_MIN,
  normalizeIntakeChoiceListOptions,
  type IntakeChoiceListOption,
} from "@/lib/intake/choice-list-options";

export const ADVISOR_INTAKE_ONLY_ANSWER_TYPES = [
  "choice_list",
  "multi_select",
  "property_list",
] as const;

/** Intake-only choice types whose option labels are stored in `options` JSON. */
export const INTAKE_OPTION_ANSWER_TYPES = ["choice_list", "multi_select"] as const;

export function intakeAnswerTypeCarriesOptions(answerType: string): boolean {
  return (INTAKE_OPTION_ANSWER_TYPES as readonly string[]).includes(answerType);
}

export type AdvisorIntakeOnlyAnswerType =
  (typeof ADVISOR_INTAKE_ONLY_ANSWER_TYPES)[number];

export const ADVISOR_INTAKE_ANSWER_TYPES = [
  ...ADVISOR_ASSESSMENT_ANSWER_TYPES,
  ...ADVISOR_INTAKE_ONLY_ANSWER_TYPES,
] as const;

export type AdvisorIntakeAnswerType =
  | AdvisorAssessmentAnswerType
  | AdvisorIntakeOnlyAnswerType;

export const ADVISOR_INTAKE_ANSWER_TYPE_OPTIONS: ReadonlyArray<{
  value: AdvisorIntakeAnswerType;
  label: string;
}> = [
  ...ADVISOR_ASSESSMENT_ANSWER_TYPE_OPTIONS,
  { value: "choice_list", label: "Multiple choice — pick one (2–10 options)" },
  { value: "multi_select", label: "Select all that apply (2–10 options)" },
  { value: "property_list", label: "Properties — ZIP codes (up to 5)" },
];

const intakeChoiceListOptionSchema = z.object({
  value: z.string().min(1).max(20),
  label: z.string().trim().min(1, "Option label is required").max(500),
});

const advisorIntakeQuestionInputSchema = advisorAssessmentQuestionInputSchema
  .extend({
    answerType: z.enum(ADVISOR_INTAKE_ANSWER_TYPES),
    options: z.array(intakeChoiceListOptionSchema).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (!intakeAnswerTypeCarriesOptions(data.answerType)) return;

    const options = data.options ?? [];
    if (options.length < INTAKE_CHOICE_LIST_MIN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Provide at least ${INTAKE_CHOICE_LIST_MIN} options`,
        path: ["options"],
      });
    }
    if (options.length > INTAKE_CHOICE_LIST_MAX) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `At most ${INTAKE_CHOICE_LIST_MAX} options are allowed`,
        path: ["options"],
      });
    }
  });

export type AdvisorIntakeQuestionInput = Omit<
  AdvisorAssessmentQuestionInput,
  "answerType"
> & {
  answerType: AdvisorIntakeAnswerType;
  options?: IntakeChoiceListOption[] | null;
};

export type AdvisorIntakeQuestionFormPayload = {
  questionText: string;
  context: string | null;
  answerType: string;
  answer0?: string | null;
  answer1?: string | null;
  answer2?: string | null;
  answer3?: string | null;
  options?: IntakeChoiceListOption[] | null;
};

export function labelForAdvisorIntakeAnswerType(answerType: string): string {
  return (
    ADVISOR_INTAKE_ANSWER_TYPE_OPTIONS.find((option) => option.value === answerType)
      ?.label ?? labelForAdvisorAssessmentAnswerType(answerType)
  );
}

export function readAdvisorIntakeQuestionForm(
  formData: FormData,
): AdvisorIntakeQuestionFormPayload {
  const assessment = readAdvisorAssessmentQuestionForm(formData);
  const answerType =
    formData.get("answerType")?.toString() ?? assessment.answerType ?? "fillable";
  const optionLabels = formData
    .getAll("optionLabel")
    .map((entry) => entry.toString().trim())
    .filter(Boolean);
  const options = intakeAnswerTypeCarriesOptions(answerType)
    ? normalizeIntakeChoiceListOptions(optionLabels)
    : null;

  return {
    questionText: assessment.questionText,
    context: formData.get("context")?.toString()?.trim() || assessment.whyThisMatters || null,
    answerType,
    answer0: assessment.answer0,
    answer1: assessment.answer1,
    answer2: assessment.answer2,
    answer3: assessment.answer3,
    options,
  };
}

/** Client-side validation before submitting intake question forms. */
export function validateAdvisorIntakeQuestionFormClient(formData: FormData): string | null {
  const payload = readAdvisorIntakeQuestionForm(formData);
  if (!payload.questionText.trim()) {
    return "Question text is required";
  }

  if (intakeAnswerTypeCarriesOptions(payload.answerType)) {
    const optionCount = payload.options?.length ?? 0;
    if (optionCount < INTAKE_CHOICE_LIST_MIN) {
      return `Provide at least ${INTAKE_CHOICE_LIST_MIN} non-empty options`;
    }
    if (optionCount > INTAKE_CHOICE_LIST_MAX) {
      return `At most ${INTAKE_CHOICE_LIST_MAX} options are allowed`;
    }
  }

  return null;
}

export function parseAdvisorIntakeQuestionInput(
  data: unknown,
):
  | { success: true; data: AdvisorIntakeQuestionInput }
  | { success: false; error: string } {
  const parsed = advisorIntakeQuestionInputSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid question data",
    };
  }

  return { success: true, data: parsed.data };
}

export function buildAdvisorIntakeQuestionWriteData(input: AdvisorIntakeQuestionInput) {
  const context = input.whyThisMatters ?? null;

  if (intakeAnswerTypeCarriesOptions(input.answerType)) {
    return {
      questionText: input.questionText,
      context,
      helpText: context,
      answerType: input.answerType,
      answer0: input.answer0 ?? null,
      answer1: input.answer1 ?? null,
      answer2: input.answer2 ?? null,
      answer3: input.answer3 ?? null,
      options: input.options?.length ? input.options : Prisma.JsonNull,
      ...(input.isVisible !== undefined ? { isVisible: input.isVisible } : {}),
    };
  }

  if (input.answerType === "property_list") {
    // Fixed-shape repeatable input — no author-defined options or answer labels.
    return {
      questionText: input.questionText,
      context,
      helpText: context,
      answerType: input.answerType,
      answer0: null,
      answer1: null,
      answer2: null,
      answer3: null,
      options: Prisma.JsonNull,
      ...(input.isVisible !== undefined ? { isVisible: input.isVisible } : {}),
    };
  }

  const assessmentWrite = buildAdvisorAssessmentQuestionWriteData(
    input as AdvisorAssessmentQuestionInput,
  );

  return {
    questionText: assessmentWrite.questionText,
    context,
    helpText: context,
    answerType: assessmentWrite.answerType,
    answer0: assessmentWrite.answer0,
    answer1: assessmentWrite.answer1,
    answer2: assessmentWrite.answer2,
    answer3: assessmentWrite.answer3,
    options: Prisma.JsonNull,
    ...(input.isVisible !== undefined ? { isVisible: input.isVisible } : {}),
  };
}
