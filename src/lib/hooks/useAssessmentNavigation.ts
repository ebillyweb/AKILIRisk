import { useRouter } from 'next/navigation';
import { useRef, useEffect, useMemo } from 'react';
import { useAssessmentStore } from '@/lib/assessment/store';
import { getVisibleQuestions, detectBranchingChanges } from '@/lib/assessment/branching';
import { hasDocumentUploadFiles } from '@/lib/assessment/question-upload';
import { Question } from '@/lib/assessment/types';

/**
 * Assessment Navigation Hook
 *
 * Navigation logic with branching support.
 * Handles question flow, visibility, and progress tracking.
 */

export interface NavigationProgress {
  answered: number;
  total: number;
  percentage: number;
}

export interface BranchingChange {
  newlyVisible: string[];
  newlyHidden: string[];
  unchanged: string[];
}

export interface UseAssessmentNavigationReturn {
  currentQuestion: Question | null;
  currentIndex: number;
  goNext: () => void;
  goBack: () => void;
  canGoBack: boolean;
  isLastQuestion: boolean;
  progress: NavigationProgress;
  visibleQuestions: Question[];
  branchingChange: BranchingChange | null;
}

export interface UseAssessmentNavigationOptions {
  visibleSubCategories?: string[];
  questions?: Question[];
}

export function useAssessmentNavigation(
  pillarSlug: string,
  questionIndex: number,
  options?: UseAssessmentNavigationOptions
): UseAssessmentNavigationReturn {
  const router = useRouter();
  const { answers, setCurrentPosition, householdProfile, familyGovernanceQuestionBank, skippedQuestions } =
    useAssessmentStore();

  const questionSet = options?.questions ?? familyGovernanceQuestionBank ?? [];
  const pillarQuestions = questionSet.filter((q) => q.pillar === pillarSlug);

  // Apply subcategory filtering first (for customization)
  const subcategoryFiltered = options?.visibleSubCategories?.length
    ? pillarQuestions.filter(q => options.visibleSubCategories!.includes(q.subCategory))
    : pillarQuestions;

  // Get visible questions based on branching rules (applied after subcategory filtering)
  const visibleQuestions = getVisibleQuestions(answers, subcategoryFiltered, householdProfile);

  // Track previous answers for branching change detection
  const previousAnswersRef = useRef<Record<string, unknown>>(answers);

  // Detect branching changes
  const branchingChange = useMemo(() => {
    const previousAnswers = previousAnswersRef.current;

    // Only calculate if answers have actually changed
    if (JSON.stringify(previousAnswers) === JSON.stringify(answers)) {
      return null;
    }

    return detectBranchingChanges(previousAnswers, answers, subcategoryFiltered, householdProfile);
  }, [answers, subcategoryFiltered]);

  // Update previous answers ref after change detection
  useEffect(() => {
    previousAnswersRef.current = answers;
  }, [answers]);

  // Get current question by index, auto-adjust if current question is hidden
  let adjustedIndex = questionIndex;

  // If current question is hidden due to branching, find nearest visible question
  const currentQuestionAtIndex = visibleQuestions[questionIndex];
  if (!currentQuestionAtIndex && visibleQuestions.length > 0) {
    // Current question is hidden, adjust to nearest visible question
    adjustedIndex = Math.min(questionIndex, visibleQuestions.length - 1);
  }

  const currentQuestion = visibleQuestions[adjustedIndex] || null;

  // Calculate progress
  const answeredCount = visibleQuestions.filter((q) => {
    if (skippedQuestions.includes(q.id)) return true;
    const answer = answers[q.id];
    if (answer === undefined || answer === null) return false;
    if (q.type === "document-upload") {
      return hasDocumentUploadFiles(answer);
    }
    return true;
  }).length;

  const progress: NavigationProgress = {
    answered: answeredCount,
    total: visibleQuestions.length,
    percentage: visibleQuestions.length > 0
      ? Math.round((answeredCount / visibleQuestions.length) * 100)
      : 0,
  };

  // Navigation state - use adjusted index
  const canGoBack = adjustedIndex > 0;
  const isLastQuestion = adjustedIndex >= visibleQuestions.length - 1;

  // Navigation functions - use adjusted index
  const goNext = () => {
    if (!currentQuestion) return;

    // Update store position
    setCurrentPosition(pillarSlug, adjustedIndex + 1);

    if (isLastQuestion) {
      // Last question in pillar - navigate to completion page
      router.push('/assessment/complete');
    } else {
      // Navigate to next visible question
      const nextIndex = adjustedIndex + 1;
      router.push(`/assessment/${pillarSlug}/${nextIndex}`);
    }
  };

  const goBack = () => {
    if (!canGoBack) return;

    const prevIndex = adjustedIndex - 1;

    // Update store position
    setCurrentPosition(pillarSlug, prevIndex);

    // Navigate to previous question
    router.push(`/assessment/${pillarSlug}/${prevIndex}`);
  };

  return {
    currentQuestion,
    currentIndex: adjustedIndex,
    goNext,
    goBack,
    canGoBack,
    isLastQuestion,
    progress,
    visibleQuestions,
    branchingChange,
  };
}
