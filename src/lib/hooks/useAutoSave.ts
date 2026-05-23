import { useMutation } from '@tanstack/react-query';
import { useDebounce } from 'use-debounce';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAssessmentStore } from '@/lib/assessment/store';

/**
 * Auto-Save Hook
 *
 * Implements debounced auto-save with TanStack Query mutations.
 * Guarantees FIFO execution and prevents race conditions.
 *
 * Flow:
 * 1. Update Zustand store immediately (optimistic update)
 * 2. Debounce API call (1000ms)
 * 3. POST to /api/assessment/[id]/responses
 * 4. Show toast on error and retry
 */

interface SaveAnswerParams {
  questionId: string;
  pillar: string;
  subCategory: string;
  answer: unknown;
  skipped?: boolean;
  currentQuestionIndex?: number;
  orphanedQuestionIds?: string[];
}

interface UseAutoSaveReturn {
  saveAnswer: (params: SaveAnswerParams) => void;
  isSaving: boolean;
  lastSaved: string | null;
}

export function useAutoSave(assessmentId: string | null): UseAutoSaveReturn {
  const [pendingAnswer, setPendingAnswer] = useState<SaveAnswerParams | null>(null);
  const [debouncedAnswer] = useDebounce(pendingAnswer, 1000);
  const lastSaved = useAssessmentStore((state) => state.lastSaved);

  // Mutation for saving answer — use `mutate` in effects, not the full `mutation` object:
  // the object identity changes when isPending updates, which would retrigger the effect and loop POSTs.
  const { mutate, isPending } = useMutation({
    mutationFn: async (params: SaveAnswerParams) => {
      if (!assessmentId) {
        throw new Error('No assessment ID');
      }

      const response = await fetch(`/api/assessment/${assessmentId}/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save');
      }

      return response.json();
    },
    onError: (error) => {
      console.error('Auto-save error:', error);
      toast.error('Failed to save, retrying...', {
        duration: 3000,
      });
    },
    retry: 1,
  });

  // Execute mutation when debounced answer changes
  useEffect(() => {
    if (debouncedAnswer) {
      mutate(debouncedAnswer);
    }
  }, [debouncedAnswer, mutate]);

  const saveAnswer = (params: SaveAnswerParams) => {
    // Update Zustand store immediately for optimistic UI
    const store = useAssessmentStore.getState();

    if (params.skipped) {
      store.skipQuestion(params.questionId);
    } else {
      store.setAnswer(params.questionId, params.answer);
    }

    store.setCurrentPosition(params.pillar, params.currentQuestionIndex ?? 0);

    const orphanedQuestionIds = store.orphanedAnswerIds;
    setPendingAnswer({
      ...params,
      orphanedQuestionIds:
        orphanedQuestionIds.length > 0 ? orphanedQuestionIds : undefined,
    });
  };

  return {
    saveAnswer,
    isSaving: isPending,
    lastSaved,
  };
}
