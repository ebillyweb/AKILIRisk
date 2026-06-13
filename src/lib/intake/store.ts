import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Intake Interview Store
 *
 * Responses and currentQuestionIndex are intentionally not persisted: they must match
 * the server and the current pillar script (question UUIDs / order can change). Persisting
 * them caused rehydrated stale maps to show the wrong recording for a question.
 */

export interface InterviewResponse {
  audioUrl?: string;
  audioDuration?: number;
  transcription?: string;
  transcriptionEditedAt?: string;
  skipped?: boolean;
  status: 'recording' | 'completed' | 'uploading' | 'failed' | 'pending';
}

interface IntakeState {
  // State
  interviewId: string | null;
  currentQuestionIndex: number;
  responses: Record<string, InterviewResponse>;
  status: 'not_started' | 'in_progress' | 'completed' | 'paused';
  startedAt: string | null;

  // Actions
  setInterviewId: (id: string) => void;
  setCurrentQuestion: (index: number) => void;
  setResponse: (questionId: string, data: Partial<InterviewResponse>) => void;
  /** Replace the whole responses map (e.g. after server load). Avoids orphan keys from merge-only updates. */
  replaceResponses: (responses: Record<string, InterviewResponse>) => void;
  setStatus: (status: IntakeState['status']) => void;
  reset: () => void;

  // Computed getters
  getTotalAnswered: () => number;
  getIsComplete: () => boolean;
}

const initialState = {
  interviewId: null,
  currentQuestionIndex: 0,
  responses: {},
  status: 'not_started' as const,
  startedAt: null,
};

export const useIntakeStore = create<IntakeState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setInterviewId: (id: string) =>
        set({
          interviewId: id,
          startedAt: new Date().toISOString()
        }),

      setCurrentQuestion: (index: number) =>
        set({ currentQuestionIndex: index }),

      setResponse: (questionId: string, data: Partial<InterviewResponse>) =>
        set((state) => ({
          responses: {
            ...state.responses,
            [questionId]: {
              ...state.responses[questionId],
              ...data,
            },
          },
        })),

      replaceResponses: (responses: Record<string, InterviewResponse>) =>
        set({ responses }),

      setStatus: (status: IntakeState['status']) =>
        set({ status }),

      reset: () =>
        set(initialState),

      // Computed getters
      getTotalAnswered: () => {
        const state = get();
        return Object.values(state.responses).filter((response) => {
          if (response.status !== 'completed') return false;
          if (response.audioUrl) return true;
          return Boolean(response.transcription?.trim());
        }).length;
      },

      getIsComplete: () => {
        const state = get();
        // Note: TOTAL_QUESTIONS will be defined when intake/questions.ts is created in Plan 01
        // For now, we'll use a placeholder that works with the navigation logic
        const TOTAL_QUESTIONS = 10; // This will be imported from questions.ts later
        return state.getTotalAnswered() === TOTAL_QUESTIONS;
      },
    }),
    {
      name: 'intake-interview-v2',
      partialize: (state) => ({
        interviewId: state.interviewId,
        status: state.status,
        startedAt: state.startedAt,
      }),
    }
  )
);