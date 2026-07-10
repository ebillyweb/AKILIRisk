import { Prisma } from '@prisma/client';

// TypeScript types matching Prisma enums
export type IntakeStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'SUBMITTED';
export type TranscriptionStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

import type { IntakeChoiceListOption } from "@/lib/intake/choice-list-options";

// Interview question structure
export interface IntakeQuestion {
  id: string;
  questionNumber: number;
  questionText: string;
  /** Same answer types as assessment questions plus intake-only types (e.g. choice_list). */
  answerType: string;
  answer0?: string | null;
  answer1?: string | null;
  answer2?: string | null;
  answer3?: string | null;
  /** Custom multiple-choice options when answerType is choice_list. */
  options?: IntakeChoiceListOption[] | null;
  /** Pillar “why this matters” / risk relevance — staff review only; never shown to clients. */
  whyThisMatters?: string;
  /** Pillar recommended actions — staff review / report queue; not shown to clients. */
  recommendedActions?: string;
  /** Epic 5.11: canonical pillar ids for advisor recommendations at approval. */
  relatedPillarIds?: string[];
  /** Coaching prompt for clients (on-screen + TTS). Staff-only rubric copy lives in whyThisMatters. */
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