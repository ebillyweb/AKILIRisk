import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useIntakeStore } from "@/lib/intake/store";
import {
  enqueuePendingIntakeSave,
  pendingIntakeSaveCount,
  shiftPendingIntakeSave,
  type PendingIntakeSave,
} from "@/lib/intake/pending-response-queue";

export type IntakeSaveParams = PendingIntakeSave;

type SaveFn = (
  params: IntakeSaveParams,
) => Promise<{ success: boolean; error?: string }>;

interface UseIntakeAutoSaveReturn {
  saveResponse: (params: IntakeSaveParams) => void;
  saveTypedDraft: (questionId: string, transcription: string) => void;
  skipQuestion: (questionId: string) => void;
  flushPendingSaves: () => Promise<void>;
  isSaving: boolean;
}

const DRAIN_DEBOUNCE_MS = 400;

export function useIntakeAutoSave(
  interviewId: string | null,
  saveFn: SaveFn,
): UseIntakeAutoSaveReturn {
  const [isSaving, setIsSaving] = useState(false);
  const queueRef = useRef(new Map<string, IntakeSaveParams>());
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

  const drainQueue = useCallback(async () => {
    if (!interviewId || pendingIntakeSaveCount(queueRef.current) === 0) {
      if (isMountedRef.current) setIsSaving(false);
      return;
    }

    if (isMountedRef.current) setIsSaving(true);

    while (pendingIntakeSaveCount(queueRef.current) > 0) {
      const params = shiftPendingIntakeSave(queueRef.current);
      if (!params) break;

      const result = await saveFn(params);
      if (!result.success) {
        toast.error(result.error ?? "Failed to save response");
        break;
      }
    }

    if (isMountedRef.current) setIsSaving(false);
  }, [interviewId, saveFn]);

  const scheduleDrain = useCallback(() => {
    if (drainTimerRef.current) {
      clearTimeout(drainTimerRef.current);
    }
    drainTimerRef.current = setTimeout(() => {
      drainChainRef.current = drainChainRef.current.then(() => drainQueue());
    }, DRAIN_DEBOUNCE_MS);
  }, [drainQueue]);

  const flushPendingSaves = useCallback(async () => {
    if (drainTimerRef.current) {
      clearTimeout(drainTimerRef.current);
      drainTimerRef.current = null;
    }
    await drainChainRef.current;
    await drainQueue();
  }, [drainQueue]);

  const saveResponse = useCallback(
    (params: IntakeSaveParams) => {
      const store = useIntakeStore.getState();

      if (params.skipped) {
        store.setResponse(params.questionId, {
          skipped: true,
          status: "completed",
          transcription: undefined,
        });
      } else if (params.transcription !== undefined) {
        store.setResponse(params.questionId, {
          transcription: params.transcription,
          status: "completed",
          skipped: false,
        });
      }

      enqueuePendingIntakeSave(queueRef.current, params);
      scheduleDrain();
    },
    [scheduleDrain],
  );

  const saveTypedDraft = useCallback(
    (questionId: string, transcription: string) => {
      const trimmed = transcription.trim();
      if (!trimmed) return;
      saveResponse({ questionId, transcription: trimmed, skipped: false });
    },
    [saveResponse],
  );

  const skipQuestion = useCallback(
    (questionId: string) => {
      saveResponse({ questionId, skipped: true });
    },
    [saveResponse],
  );

  return {
    saveResponse,
    saveTypedDraft,
    skipQuestion,
    flushPendingSaves,
    isSaving,
  };
}
