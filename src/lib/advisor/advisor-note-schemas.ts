import { z } from "zod";

// US-46c: advisor advisory notes on individual intake/assessment answers.
// Mirrors the US-46b admin schemas in @/lib/admin/answer-note-schemas — kept
// in a separate file so the two channels' input validation can diverge
// without coupling, even though the body shape is currently identical.

export const ANSWER_ADVISOR_NOTE_MAX_LENGTH = 4000;

export const answerAdvisorNoteBodySchema = z
  .string()
  .trim()
  .min(1, "Note cannot be empty.")
  .max(
    ANSWER_ADVISOR_NOTE_MAX_LENGTH,
    `Note must be at most ${ANSWER_ADVISOR_NOTE_MAX_LENGTH} characters.`
  );

export const intakeAnswerAdvisorNoteInputSchema = z.object({
  intakeResponseId: z.string().min(1),
  body: answerAdvisorNoteBodySchema,
});

export const intakeQuestionAdvisorNoteInputSchema = z.object({
  interviewId: z.string().min(1),
  questionId: z.string().min(1),
  body: answerAdvisorNoteBodySchema,
});

export const assessmentAnswerAdvisorNoteInputSchema = z.object({
  assessmentResponseId: z.string().min(1),
  body: answerAdvisorNoteBodySchema,
});
