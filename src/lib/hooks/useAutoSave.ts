import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAssessmentStore } from '@/lib/assessment/store';
import {
  enqueuePendingAnswer,
  pendingAnswerCount,
  shiftPendingAnswer,
  type PendingAnswerSave,
} from '@/lib/assessment/pending-answer-queue';

/**
 * Auto-Save Hook
 *
 * 1. Update Zustand immediately (optimistic)
 * 2. Enqueue server save per question (latest wins for same questionId)
 * 3. Debounce drain for in-progress edits (text / multi-file upload)
 * 4. flushPendingSaves() before navigation — never drop prior questions
 */

export type SaveAnswerParams = PendingAnswerSave;

interface UseAutoSaveReturn {
  saveAnswer: (params: SaveAnswerParams) => void;
  flushPendingSaves: () => Promise<void>;
  isSaving: boolean;
  lastSaved: string | null;
}

const DRAIN_DEBOUNCE_MS = 400;

export type UseAutoSaveOptions = {
  facilitatedSessionId?: string;
};

export function useAutoSave(
  assessmentId: string | null,
  options?: UseAutoSaveOptions,
): UseAutoSaveReturn {
  const facilitatedSessionId = options?.facilitatedSessionId;
  const [isSaving, setIsSaving] = useState(false);
  const lastSaved = useAssessmentStore((state) => state.lastSaved);

  const queueRef = useRef(new Map<string, SaveAnswerParams>());
  const drainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drainChainRef = useRef<Promise<void>>(Promise.resolve());
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (drainTimerRef.current) {
        clearTimeout(drainTimerRef.current);
      }
    };
  }, []);

  const { mutateAsync } = useMutation({
    mutationFn: async (params: SaveAnswerParams) => {
      if (!assessmentId) {
        throw new Error('No assessment ID');
      }

      const response = await fetch(`/api/assessment/${assessmentId}/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...params,
          ...(facilitatedSessionId ? { facilitatedSessionId } : {}),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save');
      }

      return response.json();
    },
    retry: 1,
  });

  const drainQueue = useCallback(async () => {
    if (!assessmentId || pendingAnswerCount(queueRef.current) === 0) {
      return;
    }

    setIsSaving(true);
    try {
      while (pendingAnswerCount(queueRef.current) > 0) {
        const params = shiftPendingAnswer(queueRef.current);
        if (!params) break;

        try {
          await mutateAsync(params);
        } catch (error) {
          // Re-queue failed item at the front so a later flush can retry.
          const retryQueue = new Map<string, SaveAnswerParams>();
          retryQueue.set(params.questionId, params);
          for (const [id, item] of queueRef.current) {
            retryQueue.set(id, item);
          }
          queueRef.current = retryQueue;

          console.error('Auto-save error:', error);
          toast.error('Failed to save, retrying...', { duration: 3000 });
          throw error;
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsSaving(false);
      }
    }
  }, [assessmentId, mutateAsync]);

  const scheduleDrain = useCallback(() => {
    if (drainTimerRef.current) {
      clearTimeout(drainTimerRef.current);
    }
    drainTimerRef.current = setTimeout(() => {
      drainTimerRef.current = null;
      drainChainRef.current = drainChainRef.current
        .then(() => drainQueue())
        .catch(() => undefined);
    }, DRAIN_DEBOUNCE_MS);
  }, [drainQueue]);

  const flushPendingSaves = useCallback(async () => {
    if (drainTimerRef.current) {
      clearTimeout(drainTimerRef.current);
      drainTimerRef.current = null;
    }
    drainChainRef.current = drainChainRef.current
      .then(() => drainQueue())
      .catch(() => undefined);
    await drainChainRef.current;
  }, [drainQueue]);

  const saveAnswer = useCallback(
    (params: SaveAnswerParams) => {
      const store = useAssessmentStore.getState();

      if (params.skipped) {
        store.skipQuestion(params.questionId);
      } else {
        store.setAnswer(params.questionId, params.answer);
      }

      store.setCurrentPosition(params.pillar, params.currentQuestionIndex ?? 0);

      const orphanedQuestionIds = store.orphanedAnswerIds;
      enqueuePendingAnswer(queueRef.current, {
        ...params,
        orphanedQuestionIds:
          orphanedQuestionIds.length > 0 ? orphanedQuestionIds : undefined,
      });

      scheduleDrain();
    },
    [scheduleDrain]
  );

  return {
    saveAnswer,
    flushPendingSaves,
    isSaving,
    lastSaved,
  };
}
