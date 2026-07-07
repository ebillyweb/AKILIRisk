import { useCallback, useEffect, useMemo } from "react";
import { useIntakeStore, type InterviewResponse } from "@/lib/intake/store";
import { isInterviewResponseComplete } from "@/lib/intake/is-response-complete";
import type { IntakeQuestion } from "@/lib/intake/types";

/**
 * Intake Interview Navigation Hook
 *
 * `scriptQuestions` is the ordered pillar intake script (or legacy fallback) from the server.
 */

export interface UseIntakeInterviewReturn {
  currentQuestion: IntakeQuestion | null;
  currentIndex: number;
  totalQuestions: number;
  progress: number;
  canGoNext: boolean;
  canGoPrev: boolean;
  goToNext: () => void;
  goToPrev: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  getResponseForQuestion: (questionId: string) => InterviewResponse | undefined;
}

export function useIntakeInterview(
  interviewId: string,
  scriptQuestions: IntakeQuestion[]
): UseIntakeInterviewReturn {
  const currentQuestionIndex = useIntakeStore((s) => s.currentQuestionIndex);
  const responses = useIntakeStore((s) => s.responses);
  const setCurrentQuestion = useIntakeStore((s) => s.setCurrentQuestion);
  const setInterviewId = useIntakeStore((s) => s.setInterviewId);
  const setStatus = useIntakeStore((s) => s.setStatus);

  useEffect(() => {
    if (!interviewId) return;
    const { interviewId: stored } = useIntakeStore.getState();
    if (interviewId !== stored) {
      setInterviewId(interviewId);
      setStatus("in_progress");
    }
  }, [interviewId, setInterviewId, setStatus]);

  const n = scriptQuestions.length;

  useEffect(() => {
    if (n === 0) return;
    const maxIdx = n - 1;
    if (currentQuestionIndex > maxIdx) {
      setCurrentQuestion(maxIdx);
    }
  }, [n, currentQuestionIndex, setCurrentQuestion]);

  const currentQuestion = useMemo(
    () => (n > 0 ? (scriptQuestions[currentQuestionIndex] ?? null) : null),
    [n, scriptQuestions, currentQuestionIndex]
  );

  const currentQuestionResponse = currentQuestion ? responses[currentQuestion.id] : undefined;
  const hasCurrentResponse = isInterviewResponseComplete(currentQuestionResponse);

  const isFirstQuestion = currentQuestionIndex === 0;
  const isLastQuestion = n > 0 && currentQuestionIndex >= n - 1;
  const canGoPrev = currentQuestionIndex > 0;
  const canGoNext =
    n > 0 && (currentQuestionIndex < n - 1 || (isLastQuestion && hasCurrentResponse));

  const denom = Math.max(n, 1);
  const progress = Math.round((currentQuestionIndex / denom) * 100);

  const goToNext = useCallback(() => {
    if (n === 0) return;
    const q = scriptQuestions[currentQuestionIndex];
    if (!q) return;
    const resp = responses[q.id];
    const has = isInterviewResponseComplete(resp);
    const last = currentQuestionIndex >= n - 1;
    if (last && has) return;
    if (currentQuestionIndex < n - 1) {
      setCurrentQuestion(currentQuestionIndex + 1);
    }
  }, [n, currentQuestionIndex, responses, scriptQuestions, setCurrentQuestion]);

  const goToPrev = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestion(Math.max(0, currentQuestionIndex - 1));
    }
  }, [currentQuestionIndex, setCurrentQuestion]);

  const getResponseForQuestion = useCallback(
    (questionId: string) => responses[questionId],
    [responses]
  );

  return {
    currentQuestion,
    currentIndex: currentQuestionIndex,
    totalQuestions: n,
    progress,
    canGoNext,
    canGoPrev,
    goToNext,
    goToPrev,
    isFirstQuestion,
    isLastQuestion,
    getResponseForQuestion,
  };
}
