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

/**
 * Note keyed by (assessment, question) rather than an existing response id —
 * used during live facilitation, where the advisor may add a note before an
 * answer row exists. `pillar`/`subCategory` seed the placeholder response.
 */
export const assessmentQuestionAdvisorNoteInputSchema = z.object({
  assessmentId: z.string().min(1),
  questionId: z.string().min(1),
  pillar: z.string().min(1),
  // Some questions carry an empty subCategory; mirror how answers are saved
  // rather than rejecting a note the equivalent answer would accept.
  subCategory: z.string(),
  body: answerAdvisorNoteBodySchema,
});
