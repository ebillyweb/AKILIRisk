import { z } from "zod";

/** Only `questionText` is spoken; other fields are accepted for backwards compatibility. */
export const questionTtsBodySchema = z.object({
  questionText: z.string().min(1).max(2000),
  moduleName: z.string().optional(),
  context: z.string().optional(),
  learnMore: z.string().optional(),
  recordingTips: z.array(z.string()).optional(),
  questionNumber: z.number().int().positive().optional(),
  totalQuestions: z.number().int().positive().optional(),
});

export type QuestionTtsBody = z.infer<typeof questionTtsBodySchema>;

/** Play Question reads only the question prompt — not module, progress, or guidance. */
export function buildQuestionNarrationText(input: QuestionTtsBody): string {
  return input.questionText.trim();
}
