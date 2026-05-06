import { Prisma } from '@prisma/client';

// TypeScript types matching Prisma enums
export type IntakeStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'SUBMITTED';
export type TranscriptionStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

// Interview question structure
export interface IntakeQuestion {
  id: string;
  questionNumber: number;
  questionText: string;
  /** Pillar “why this matters” / risk relevance — optional; never show as body copy, tooltip only. */
  whyThisMatters?: string;
  /** Guidance for TTS (includes tone fallback when pillar has no rubric text). */
  context: string;
  recordingTips: string[];
}

// Prisma include pattern for IntakeInterview with responses.
// Round-11 commit 2.4b: User.email column dropped; use emailCiphertext.
export type IntakeInterviewWithResponses = Prisma.IntakeInterviewGetPayload<{
  include: {
    responses: true;
    user: {
      select: {
        id: true;
        name: true;
        emailCiphertext: true;
      };
    };
  };
}>;