/**
 * Branching Logic for Assessment Questions
 *
 * Implements conditional question display based on prerequisite answers.
 * Start simple with 1-level branching:
 * - Trust questions skip if no trusts
 * - Business questions skip if no family business
 * - Succession questions skip if no heirs
 */

import { branchingPredicateToRule } from './bank/behaviors';
import type { BranchingRule, Question } from './types';
import { HouseholdProfile } from './personalization';

/** Rebuild branching when `showIf` was stripped by JSON serialization (API / React Query). */
export function resolveBranchingRule(question: Question): BranchingRule | undefined {
  if (typeof question.branchingRule?.showIf === 'function') {
    return question.branchingRule;
  }

  const dependsOn =
    question.branchingDependsOn ?? question.branchingRule?.dependsOn;
  if (!dependsOn) return undefined;

  return branchingPredicateToRule(dependsOn, question.branchingPredicate);
}

/**
 * Determine if a question should be shown based on current answers and optional profile
 *
 * @param question - Question to evaluate
 * @param answers - Current user answers
 * @param profile - Optional household profile for profile-based conditions
 * @returns true if question should be shown, false if skipped
 */
export function shouldShowQuestion(
  question: Question,
  answers: Record<string, unknown>,
  profile?: HouseholdProfile | null
): boolean {
  const branchingRule = resolveBranchingRule(question);
  if (branchingRule) {
    const { dependsOn, showIf } = branchingRule;
    const dependencyAnswer = answers[dependsOn];
    if (dependencyAnswer === undefined || dependencyAnswer === null) {
      return false;
    }
    if (!showIf(dependencyAnswer)) {
      return false;
    }
  }

  // Profile-based condition: hidden when no profile or condition fails.
  if (question.profileCondition) {
    if (!profile) {
      return false;
    }
    return question.profileCondition(profile);
  }

  // Default: show question (backward compat — no profile = show everything)
  return true;
}

/**
 * Get next visible question in sequence
 *
 * @param currentId - Current question ID (or null for first question)
 * @param answers - Current user answers
 * @param allQuestions - All questions in order
 * @param profile - Optional household profile for profile-based conditions
 * @returns Next visible question ID, or null if end of assessment
 */
export function getNextQuestion(
  currentId: string | null,
  answers: Record<string, unknown>,
  allQuestions: Question[],
  profile?: HouseholdProfile | null
): string | null {
  // If no current question, return first question
  if (currentId === null) {
    if (allQuestions.length === 0) {
      return null;
    }
    return allQuestions[0].id;
  }

  // Find current question index
  const currentIndex = allQuestions.findIndex(q => q.id === currentId);

  // If not found or at end, return null
  if (currentIndex === -1 || currentIndex >= allQuestions.length - 1) {
    return null;
  }

  // Find next visible question
  for (let i = currentIndex + 1; i < allQuestions.length; i++) {
    const question = allQuestions[i];
    if (shouldShowQuestion(question, answers, profile)) {
      return question.id;
    }
  }

  // No more visible questions
  return null;
}

/**
 * Get previous visible question in sequence
 *
 * Allows users to go back and change answers.
 *
 * @param currentId - Current question ID
 * @param answers - Current user answers
 * @param allQuestions - All questions in order
 * @param profile - Optional household profile for profile-based conditions
 * @returns Previous visible question ID, or null if at beginning
 */
export function getPreviousQuestion(
  currentId: string,
  answers: Record<string, unknown>,
  allQuestions: Question[],
  profile?: HouseholdProfile | null
): string | null {
  // Find current question index
  const currentIndex = allQuestions.findIndex(q => q.id === currentId);

  // If not found or at beginning, return null
  if (currentIndex <= 0) {
    return null;
  }

  // Find previous visible question
  for (let i = currentIndex - 1; i >= 0; i--) {
    const question = allQuestions[i];
    if (shouldShowQuestion(question, answers, profile)) {
      return question.id;
    }
  }

  // No previous visible question
  return null;
}

/**
 * Filter questions to only those that should be visible
 *
 * @param answers - Current user answers
 * @param allQuestions - All questions
 * @param profile - Optional household profile for profile-based conditions
 * @returns Filtered array of visible questions
 */
export function getVisibleQuestions(
  answers: Record<string, unknown>,
  allQuestions: Question[],
  profile?: HouseholdProfile | null
): Question[] {
  return allQuestions.filter(question => shouldShowQuestion(question, answers, profile));
}

/**
 * Calculate assessment completion percentage
 *
 * @param answers - Current user answers
 * @param allQuestions - All questions
 * @param profile - Optional household profile for profile-based conditions
 * @returns Percentage complete (0-100)
 */
export function calculateCompletionPercentage(
  answers: Record<string, unknown>,
  allQuestions: Question[],
  profile?: HouseholdProfile | null
): number {
  const visibleQuestions = getVisibleQuestions(answers, allQuestions, profile);

  if (visibleQuestions.length === 0) {
    return 0;
  }

  const answeredCount = visibleQuestions.filter(q => {
    const answer = answers[q.id];
    return answer !== undefined && answer !== null;
  }).length;

  return Math.round((answeredCount / visibleQuestions.length) * 100);
}

/**
 * Get all required questions that are unanswered
 *
 * Used for validation before allowing submission.
 *
 * @param answers - Current user answers
 * @param allQuestions - All questions
 * @param profile - Optional household profile for profile-based conditions
 * @returns Array of required question IDs that are unanswered
 */
export function getUnansweredRequiredQuestions(
  answers: Record<string, unknown>,
  allQuestions: Question[],
  profile?: HouseholdProfile | null
): string[] {
  const visibleQuestions = getVisibleQuestions(answers, allQuestions, profile);

  return visibleQuestions
    .filter(q => {
      if (!q.required) {
        return false;
      }

      const answer = answers[q.id];
      return answer === undefined || answer === null;
    })
    .map(q => q.id);
}

/**
 * Compare visible question sets before and after an answer change
 *
 * Used by the UI to know when to auto-navigate to newly-relevant questions
 * when user changes answers that previously triggered skips.
 *
 * @param previousAnswers - Answer state before the change
 * @param currentAnswers - Answer state after the change
 * @param allQuestions - All question definitions
 * @param profile - Optional household profile for profile-based conditions
 * @returns Object with newly visible, newly hidden, and unchanged question IDs
 */
export function detectBranchingChanges(
  previousAnswers: Record<string, unknown>,
  currentAnswers: Record<string, unknown>,
  allQuestions: Question[],
  profile?: HouseholdProfile | null
): {
  newlyVisible: string[];
  newlyHidden: string[];
  unchanged: string[];
} {
  const previousVisible = new Set(
    getVisibleQuestions(previousAnswers, allQuestions, profile).map(q => q.id)
  );
  const currentVisible = new Set(
    getVisibleQuestions(currentAnswers, allQuestions, profile).map(q => q.id)
  );

  const newlyVisible: string[] = [];
  const newlyHidden: string[] = [];
  const unchanged: string[] = [];

  // Find all question IDs that could be affected
  const allQuestionIds = new Set([
    ...allQuestions.map(q => q.id),
    ...Array.from(previousVisible),
    ...Array.from(currentVisible),
  ]);

  for (const questionId of Array.from(allQuestionIds)) {
    const wasVisible = previousVisible.has(questionId);
    const isVisible = currentVisible.has(questionId);

    if (!wasVisible && isVisible) {
      newlyVisible.push(questionId);
    } else if (wasVisible && !isVisible) {
      newlyHidden.push(questionId);
    } else if (wasVisible && isVisible) {
      unchanged.push(questionId);
    }
    // Questions that were not visible before and are still not visible are ignored
  }

  return {
    newlyVisible: newlyVisible.sort(),
    newlyHidden: newlyHidden.sort(),
    unchanged: unchanged.sort(),
  };
}

/**
 * Get question IDs that have answers but are currently NOT visible (hidden by branching)
 *
 * These orphaned answers must be excluded from scoring to prevent skipped sections
 * from affecting the score calculation.
 *
 * @param answers - Current user answers
 * @param allQuestions - All question definitions
 * @param profile - Optional household profile for profile-based conditions
 * @returns Array of question IDs that are answered but currently hidden
 */
export function getOrphanedAnswerIds(
  answers: Record<string, unknown>,
  allQuestions: Question[],
  profile?: HouseholdProfile | null
): string[] {
  const visibleQuestionIds = new Set(
    getVisibleQuestions(answers, allQuestions, profile).map(q => q.id)
  );

  const orphanedIds: string[] = [];

  for (const [questionId, answer] of Object.entries(answers)) {
    // Skip questions with no answer
    if (answer === undefined || answer === null) {
      continue;
    }

    // If question has an answer but is not currently visible, it's orphaned
    if (!visibleQuestionIds.has(questionId)) {
      orphanedIds.push(questionId);
    }
  }

  return orphanedIds.sort();
}
