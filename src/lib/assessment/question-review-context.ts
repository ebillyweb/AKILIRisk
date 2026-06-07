import type { Question } from "@/lib/assessment/types";

/** Serializable question fields for staff assessment review UIs. */
export type QuestionReviewContext = Pick<
  Question,
  "id" | "text" | "helpText" | "learnMore" | "type" | "options"
>;

export function toQuestionReviewContext(question: Question): QuestionReviewContext {
  return {
    id: question.id,
    text: question.text,
    helpText: question.helpText,
    learnMore: question.learnMore,
    type: question.type,
    options: question.options,
  };
}

export function indexQuestionsForReview(
  questions: Question[],
): Record<string, QuestionReviewContext> {
  return Object.fromEntries(
    questions.map((question) => [question.id, toQuestionReviewContext(question)]),
  );
}
