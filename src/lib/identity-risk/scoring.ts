/**
 * Identity Risk Scoring Engine
 *
 * Thin wrapper around existing assessment scoring system for identity risk pillar.
 * Delegates to proven calculatePillarScore engine to ensure consistent scoring
 * across all assessment domains.
 */

import { calculatePillarScore } from '../assessment/scoring';
import { identityRiskPillar, identityRiskQuestions } from './questions';
import { ScoreResult } from '../assessment/types';
import type { RiskThresholds } from '../assessment/governance-rubric';

/**
 * Calculate identity risk score from user answers
 *
 * Delegates to existing calculatePillarScore engine to ensure consistency
 * with family governance and cyber risk scoring methodology.
 *
 * @param answers - User answers keyed by questionId
 * @param visibleQuestionIds - Optional array of question IDs to include in scoring
 * @returns ScoreResult with score (0-10), risk level, breakdown, and missing controls
 */
export function calculateIdentityRiskScore(
  answers: Record<string, unknown>,
  visibleQuestionIds?: string[],
  // A2: pass through to the underlying scorer. Defaults to the original
  // 80/60/40 bands when omitted.
  thresholds?: RiskThresholds
): ScoreResult {
  return calculatePillarScore(
    answers,
    identityRiskPillar,
    identityRiskQuestions,
    visibleQuestionIds,
    thresholds
  );
}