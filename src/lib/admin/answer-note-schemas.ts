import { z } from "zod";

export const ANSWER_ADMIN_NOTE_MAX_LENGTH = 4000;

export const answerAdminNoteBodySchema = z
  .string()
  .trim()
  .min(1, "Note cannot be empty.")
  .max(ANSWER_ADMIN_NOTE_MAX_LENGTH, `Note must be at most ${ANSWER_ADMIN_NOTE_MAX_LENGTH} characters.`);

export const intakeAnswerNoteInputSchema = z.object({
  intakeResponseId: z.string().min(1),
  body: answerAdminNoteBodySchema,
});

export const assessmentAnswerNoteInputSchema = z.object({
  assessmentResponseId: z.string().min(1),
  body: answerAdminNoteBodySchema,
});
