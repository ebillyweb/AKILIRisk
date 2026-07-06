import type { IntakeReviewData } from "@/lib/advisor/types";
import { formatIntakeAnswerDisplay } from "@/lib/pdf/intake/format-intake-answer";
import { intakeResponseHasClientAnswer } from "@/lib/intake/response-has-answer";

export type IntakePdfQuestionRow = {
  questionNumber: number;
  questionText: string;
  answerText: string;
  answerLabel?: string;
  advisorNote?: string;
};

export type IntakePdfData = {
  clientName: string;
  clientEmail: string;
  submittedAt: string | null;
  intakeStatus: string;
  responseCount: number;
  totalQuestions: number;
  questions: IntakePdfQuestionRow[];
};

function questionNumberFor(question: IntakeReviewData["questions"][0]): number {
  if (question.questionNumber != null) {
    return question.questionNumber;
  }
  const parsed = parseInt(question.id.replace("intake-q", ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Builds a serializable intake transcript payload for PDF rendering. */
export function buildIntakePdfData(review: IntakeReviewData): IntakePdfData {
  const responseByQuestionId = review.interview.responses.reduce(
    (acc, response) => {
      acc[response.questionId] = response;
      return acc;
    },
    {} as Record<string, (typeof review.interview.responses)[0]>,
  );

  const questions = review.questions.map((question) => {
    const response = responseByQuestionId[question.id];
    const formatted = formatIntakeAnswerDisplay(response, {
      answerType: question.answerType ?? question.type,
      answer0: question.answer0,
      answer1: question.answer1,
      answer2: question.answer2,
      answer3: question.answer3,
      options: question.options,
    });
    const num = questionNumberFor(question);

    return {
      questionNumber: num,
      questionText: question.questionText ?? question.text,
      answerText: formatted.answerText,
      answerLabel: formatted.answerLabel,
      advisorNote: response?.advisorNote?.body?.trim() || undefined,
    };
  });

  questions.sort((a, b) => a.questionNumber - b.questionNumber);

  const submittedAt = review.interview.submittedAt
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "long",
        timeStyle: "short",
      }).format(new Date(review.interview.submittedAt))
    : null;

  return {
    clientName: review.interview.user.name || "Unnamed Client",
    clientEmail: review.interview.user.email,
    submittedAt,
    intakeStatus: review.interview.status,
    responseCount: review.interview.responses.filter(intakeResponseHasClientAnswer)
      .length,
    totalQuestions: review.questions.length,
    questions,
  };
}

export function isIntakeExportableStatus(status: string): boolean {
  return status === "SUBMITTED" || status === "COMPLETED";
}
