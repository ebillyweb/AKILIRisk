import {
  type AdvisorAssessmentQuestionInput,
  buildAdvisorAssessmentQuestionWriteData,
  labelForAdvisorAssessmentAnswerType,
  parseAdvisorAssessmentQuestionInput,
  readAdvisorAssessmentQuestionForm,
} from "@/lib/methodology/advisor-assessment-question-config";

export {
  ADVISOR_ASSESSMENT_ANSWER_TYPE_OPTIONS,
  ADVISOR_ASSESSMENT_ANSWER_TYPES,
  labelForAdvisorAssessmentAnswerType,
  parseAdvisorAssessmentQuestionInput,
  type AdvisorAssessmentAnswerType,
} from "@/lib/methodology/advisor-assessment-question-config";

export type AdvisorIntakeQuestionInput = AdvisorAssessmentQuestionInput;

export function readAdvisorIntakeQuestionForm(formData: FormData) {
  const assessment = readAdvisorAssessmentQuestionForm(formData);
  return {
    questionText: assessment.questionText,
    context: formData.get("context")?.toString() ?? assessment.whyThisMatters ?? null,
    whyThisMatters: formData.get("context")?.toString() ?? assessment.whyThisMatters ?? null,
    recommendedActions: formData.get("recommendedActions")?.toString() ?? null,
    answerType: assessment.answerType,
    answer0: assessment.answer0,
    answer1: assessment.answer1,
    answer2: assessment.answer2,
    answer3: assessment.answer3,
  };
}

export function parseAdvisorIntakeQuestionInput(data: unknown) {
  const parsed = parseAdvisorAssessmentQuestionInput(data);
  if (!parsed.success) return parsed;
  return { success: true as const, data: parsed.data };
}

export function buildAdvisorIntakeQuestionWriteData(input: AdvisorIntakeQuestionInput) {
  const assessmentWrite = buildAdvisorAssessmentQuestionWriteData(input);
  const context = input.whyThisMatters ?? null;
  return {
    questionText: assessmentWrite.questionText,
    context,
    helpText: context,
    answerType: assessmentWrite.answerType,
    answer0: assessmentWrite.answer0,
    answer1: assessmentWrite.answer1,
    answer2: assessmentWrite.answer2,
    answer3: assessmentWrite.answer3,
    ...(input.isVisible !== undefined ? { isVisible: input.isVisible } : {}),
  };
}
