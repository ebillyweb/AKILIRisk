import { z } from 'zod';

// Schema for starting an intake interview
export const startInterviewSchema = z.object({
  userId: z.string().cuid('Invalid user ID format')
});

// Schema for saving an interview response
export const saveResponseSchema = z
  .object({
    interviewId: z.string().cuid('Invalid interview ID format'),
    questionId: z.string().min(1, 'Question ID is required'),
    audioUrl: z
      .string()
      .refine(
        (value) => value.startsWith('/') || /^https?:\/\//.test(value),
        'Invalid audio URL format'
      )
      .optional(),
    audioDuration: z.number().min(0, 'Audio duration must be positive').optional(),
    transcription: z.string().optional(),
    skipped: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.skipped === true ||
      Boolean(d.audioUrl?.trim()) ||
      Boolean(d.transcription?.trim()),
    {
      message: 'Provide a recording (audio URL), a typed response, or skip the question',
      path: ['transcription'],
    }
  );

// Schema for submitting a completed interview
export const submitInterviewSchema = z.object({
  interviewId: z.string().cuid('Invalid interview ID format')
});

// Type inference for form data
export type StartInterviewData = z.infer<typeof startInterviewSchema>;
export type SaveResponseData = z.infer<typeof saveResponseSchema>;
export type SubmitInterviewData = z.infer<typeof submitInterviewSchema>;