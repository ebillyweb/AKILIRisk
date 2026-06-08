import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getOrphanedAnswerIds } from './branching';
import type { HouseholdProfile } from './personalization';
import type { Question } from './types';
import { allIdentityQuestions } from '../identity-risk/questions';

/**
 * Assessment Store
 *
 * State management for assessment progress with localStorage persistence
 * and server rehydration support for save/resume functionality.
 */

// Server data shape for rehydration
export interface ServerAssessmentData {
  id: string;
  status: string;
  currentPillar: string | null;
  currentQuestionIndex: number | null;
  responses: {
    questionId: string;
    answer: unknown;
    skipped: boolean;
  }[];
}

interface AssessmentState {
  // State
  assessmentId: string | null;
  currentPillar: string | null;
  currentQuestionIndex: number;
  answers: Record<string, unknown>;
  skippedQuestions: string[];
  completedPillars: string[];
  lastSaved: string | null;
  isLoading: boolean;
  isHydrated: boolean;
  /** True after zustand persist finishes rehydrating from localStorage (client only). */
  persistRehydrated: boolean;
  orphanedAnswerIds: string[];
  householdProfile: HouseholdProfile | null;
  /** DB-backed family-governance questions (visible only). Loaded before assessment UI renders. */
  familyGovernanceQuestionBank: Question[] | null;

  // Actions
  setAssessmentId: (id: string) => void;
  setAnswer: (questionId: string, answer: unknown) => void;
  skipQuestion: (questionId: string) => void;
  setCurrentPosition: (pillar: string, questionIndex: number) => void;
  markPillarComplete: (pillar: string) => void;
  loadFromServer: (data: ServerAssessmentData) => void;
  resetAssessment: () => void;
  setHydrated: (hydrated: boolean) => void;
  setLoading: (loading: boolean) => void;
  cleanOrphanedAnswers: () => void;
  setHouseholdProfile: (profile: HouseholdProfile | null) => void;
  setFamilyGovernanceQuestionBank: (questions: Question[] | null) => void;
}

const initialState = {
  assessmentId: null,
  currentPillar: null,
  currentQuestionIndex: 0,
  answers: {},
  skippedQuestions: [],
  completedPillars: [],
  lastSaved: null,
  isLoading: false,
  isHydrated: false,
  persistRehydrated: false,
  orphanedAnswerIds: [],
  householdProfile: null,
  familyGovernanceQuestionBank: null,
};

function questionUniverseForOrphans(state: AssessmentState): Question[] {
  const gov = state.familyGovernanceQuestionBank ?? [];
  return [...gov, ...allIdentityQuestions];
}

let markPersistRehydrated: (() => void) | null = null;

export const useAssessmentStore = create<AssessmentState>()(
  persist(
    (set) => {
      markPersistRehydrated = () => set({ persistRehydrated: true });

      return {
      ...initialState,

      setAssessmentId: (id: string) =>
        set({ assessmentId: id }),

      setAnswer: (questionId: string, answer: unknown) =>
        set((state) => {
          const newAnswers = { ...state.answers, [questionId]: answer };
          const orphanUniverse = questionUniverseForOrphans(state);
          const newOrphanedIds =
            orphanUniverse.length === 0
              ? []
              : getOrphanedAnswerIds(
                  newAnswers,
                  orphanUniverse,
                  state.householdProfile
                );

          return {
            answers: newAnswers,
            skippedQuestions: state.skippedQuestions.filter((id) => id !== questionId),
            orphanedAnswerIds: newOrphanedIds,
            lastSaved: new Date().toISOString(),
          };
        }),

      skipQuestion: (questionId: string) =>
        set((state) => {
          const { [questionId]: _removed, ...restAnswers } = state.answers;
          return {
            answers: restAnswers,
            skippedQuestions: [...new Set([...state.skippedQuestions, questionId])],
            lastSaved: new Date().toISOString(),
          };
        }),

      setCurrentPosition: (pillar: string, questionIndex: number) =>
        set({
          currentPillar: pillar,
          currentQuestionIndex: questionIndex,
        }),

      markPillarComplete: (pillar: string) =>
        set((state) => ({
          completedPillars: [...new Set([...state.completedPillars, pillar])],
        })),

      loadFromServer: (data: ServerAssessmentData) =>
        set((state) => {
          const serverAnswers: Record<string, unknown> = {};
          const serverSkipped: string[] = [];

          data.responses.forEach((response) => {
            if (response.skipped) {
              serverSkipped.push(response.questionId);
            } else {
              serverAnswers[response.questionId] = response.answer;
            }
          });

          const mergedAnswers = { ...serverAnswers, ...state.answers };
          const mergedSkipped = [
            ...new Set([...serverSkipped, ...state.skippedQuestions]),
          ].filter((id) => mergedAnswers[id] === undefined);

          const orphanUniverse = questionUniverseForOrphans(state);
          const orphanedAnswerIds =
            orphanUniverse.length === 0
              ? []
              : getOrphanedAnswerIds(
                  mergedAnswers,
                  orphanUniverse,
                  state.householdProfile
                );

          return {
            assessmentId: data.id,
            currentPillar: data.currentPillar,
            currentQuestionIndex: data.currentQuestionIndex ?? 0,
            answers: mergedAnswers,
            skippedQuestions: mergedSkipped,
            orphanedAnswerIds,
            lastSaved: new Date().toISOString(),
          };
        }),

      resetAssessment: () =>
        set({ ...initialState, persistRehydrated: true }),

      setHydrated: (hydrated: boolean) =>
        set({ isHydrated: hydrated }),

      setLoading: (loading: boolean) =>
        set({ isLoading: loading }),

      cleanOrphanedAnswers: () =>
        set((state) => ({
          orphanedAnswerIds: getOrphanedAnswerIds(
            state.answers,
            questionUniverseForOrphans(state),
            state.householdProfile
          ),
        })),

      setHouseholdProfile: (profile: HouseholdProfile | null) =>
        set({ householdProfile: profile }),

      setFamilyGovernanceQuestionBank: (questions: Question[] | null) =>
        set({ familyGovernanceQuestionBank: questions }),
      };
    },
    {
      name: 'akili-assessment',
      partialize: (state) => ({
        assessmentId: state.assessmentId,
        currentPillar: state.currentPillar,
        currentQuestionIndex: state.currentQuestionIndex,
        answers: state.answers,
        skippedQuestions: state.skippedQuestions,
        completedPillars: state.completedPillars,
        lastSaved: state.lastSaved,
        orphanedAnswerIds: state.orphanedAnswerIds,
      }),
      onRehydrateStorage: () => (_state, error) => {
        if (!error) {
          markPersistRehydrated?.();
        }
      },
    }
  )
);
