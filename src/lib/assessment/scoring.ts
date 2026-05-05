/**
 * Assessment Scoring Engine
 *
 * Implements hierarchical weighted scoring for assessment results.
 * Calculates pillar scores by aggregating sub-category scores, which
 * aggregate question scores. Unanswered questions are excluded from
 * calculations (not treated as 0).
 */

import {
  Question,
  Pillar,
  ScoreResult,
  CategoryScore,
  MissingControl,
  RiskLevel,
} from './types';
import {
  MATURITY_SCALE_MAX,
  REMEDIATION_MATURITY_THRESHOLD,
} from './maturity-scale';
import {
  DEFAULT_RISK_THRESHOLDS,
  riskLevelFromMaturityScore,
  type RiskThresholds,
} from './governance-rubric';

/**
 * Map a raw score from a question's scoreMap onto the 0–3 maturity scale using that
 * question's own max map value (so legacy 0–10 maps and native 0–3 maps both work).
 */
/** Yes/no gate: "yes" defers maturity to follow-up questions (not aggregated here). */
export function omitYesNoMaturityScore(
  question: Question,
  rawAnswer: unknown
): boolean {
  return (
    question.type === "yes-no" &&
    question.omitMaturityScoreWhenYes === true &&
    rawAnswer === "yes"
  );
}

export function normalizeAnswerToMaturity(
  question: Question,
  rawAnswer: unknown
): number | undefined {
  const answerKey = String(rawAnswer);
  const raw = question.scoreMap[answerKey];
  if (raw === undefined) {
    return undefined;
  }
  const numericRaw = Number(raw);
  const values = Object.values(question.scoreMap).map((v) => Number(v));
  const maxV = Math.max(0, ...values);
  if (maxV <= 0) {
    return undefined;
  }
  return (numericRaw / maxV) * MATURITY_SCALE_MAX;
}

/**
 * Calculate pillar score from user answers
 *
 * Algorithm:
 * 1. For each sub-category, calculate weighted average of answered questions only
 * 2. Aggregate sub-categories using their weights
 * 3. Unanswered questions are excluded (not treated as 0)
 * 4. Track percentage answered for completeness indicator
 * 5. When visibleQuestionIds provided, only consider those questions (excludes orphaned answers)
 *
 * @param answers - User answers keyed by questionId
 * @param pillar - Pillar definition with sub-categories
 * @param allQuestions - All question definitions
 * @param visibleQuestionIds - Optional array of question IDs that should be included in scoring
 * @returns ScoreResult with score (0–3 maturity), risk level, breakdown, and missing controls
 */
export function calculatePillarScore(
  answers: Record<string, unknown>,
  pillar: Pillar,
  allQuestions: Question[],
  visibleQuestionIds?: string[],
  // A2: optional configured cutoffs. When omitted, falls back to
  // DEFAULT_RISK_THRESHOLDS (the original hardcoded 80/60/40 bands) so
  // existing callers and tests continue to work unchanged.
  thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS
): ScoreResult {
  const categoryScores: CategoryScore[] = [];
  let totalWeightedScore = 0;
  let totalWeight = 0;

  // Filter questions to only those that should be included in scoring
  const questionsToScore = visibleQuestionIds
    ? allQuestions.filter(q => visibleQuestionIds.includes(q.id))
    : allQuestions;

  // Calculate score for each sub-category
  for (const subCategory of pillar.subCategories) {
    const categoryQuestions = questionsToScore.filter(
      q => q.subCategory === subCategory.id
    );

    // Skip subcategories that have no visible questions
    if (categoryQuestions.length === 0) {
      continue;
    }

    let categoryWeightedScore = 0;
    let categoryWeight = 0;

    // Calculate weighted average for this category (answered questions only)
    for (const question of categoryQuestions) {
      const answer = answers[question.id];

      // Skip unanswered questions
      if (answer === undefined || answer === null) {
        continue;
      }

      if (omitYesNoMaturityScore(question, answer)) {
        continue;
      }

      const maturityScore = normalizeAnswerToMaturity(question, answer);

      if (maturityScore !== undefined) {
        categoryWeightedScore += maturityScore * question.weight;
        categoryWeight += question.weight;
      }
    }

    // Calculate category score (0 if no questions answered)
    const categoryScore = categoryWeight > 0
      ? categoryWeightedScore / categoryWeight
      : 0;

    categoryScores.push({
      categoryId: subCategory.id,
      categoryName: subCategory.name,
      score: Math.round(categoryScore * 100) / 100, // Round to 2 decimals
      weight: subCategory.weight,
      maxScore: MATURITY_SCALE_MAX,
    });

    // Accumulate for pillar score (only include subcategories with visible questions)
    totalWeightedScore += categoryScore * subCategory.weight;
    totalWeight += subCategory.weight;
  }

  // Calculate overall pillar score
  const pillarScore = totalWeight > 0
    ? totalWeightedScore / totalWeight
    : 0;

  // Determine risk level
  const riskLevel = getRiskLevel(pillarScore, thresholds);

  // Identify missing controls (only from visible questions)
  const missingControls = identifyMissingControls(answers, allQuestions, visibleQuestionIds);

  return {
    score: Math.round(pillarScore * 100) / 100, // Round to 2 decimals
    riskLevel,
    breakdown: categoryScores,
    missingControls,
  };
}

/**
 * Map aggregate maturity (0–3) to risk level. Bands default to the original
 * BRD §4.2 80/60/40 resilience cutoffs but accept a configured override so
 * admins can adjust thresholds at /admin/scoring/thresholds (A2 / BRD §4.2).
 */
export function getRiskLevel(
  score: number,
  thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS
): RiskLevel {
  return riskLevelFromMaturityScore(score, thresholds);
}

/**
 * Identify remediation items from answered questions in the low-maturity band (normalized ≤ threshold).
 * Returns top items sorted by remediation priority (weight × maturity gap).
 */
export function identifyMissingControls(
  answers: Record<string, unknown>,
  questions: Question[],
  visibleQuestionIds?: string[]
): MissingControl[] {
  const controls: Array<MissingControl & { sortKey: number }> = [];

  // Filter questions to only those that should be included
  const questionsToCheck = visibleQuestionIds
    ? questions.filter(q => visibleQuestionIds.includes(q.id))
    : questions;

  for (const question of questionsToCheck) {
    const answer = answers[question.id];

    // Skip unanswered questions
    if (answer === undefined || answer === null) {
      continue;
    }

    if (omitYesNoMaturityScore(question, answer)) {
      continue;
    }

    const maturityScore = normalizeAnswerToMaturity(question, answer);
    if (maturityScore === undefined) {
      continue;
    }

    // Critical gap + partial / informal (0–1 on 0–3 scale) drive definitive remediation
    if (maturityScore <= REMEDIATION_MATURITY_THRESHOLD) {
      const maturityGap = MATURITY_SCALE_MAX - maturityScore;
      const remediationPriority = question.weight * maturityGap;
      const sortKey = remediationPriority;

      // Severity from weighted gap on 0–3 scale
      let severity: 'high' | 'medium' | 'low';
      if (remediationPriority >= 9) {
        severity = 'high';
      } else if (remediationPriority >= 4.5) {
        severity = 'medium';
      } else {
        severity = 'low';
      }

      const recommendation = definitiveRemediationAction(question);

      controls.push({
        questionId: question.id,
        category: question.subCategory,
        description: question.text,
        severity,
        recommendation,
        maturityScore: Math.round(maturityScore * 100) / 100,
        remediationPriority: Math.round(remediationPriority * 100) / 100,
        ...(question.riskRelevance ? { riskRelevance: question.riskRelevance } : {}),
        sortKey,
      });
    }
  }

  controls.sort((a, b) => b.sortKey - a.sortKey);

  return controls.slice(0, 5).map(({ sortKey: _s, ...control }) => control);
}

/**
 * Calculate pillar score with emphasis multipliers for advisor-selected focus areas
 *
 * Algorithm identical to calculatePillarScore but with weighted subcategories.
 * When accumulating subcategory scores into pillar total, multiplies each
 * subcategory's weight by its emphasis multiplier (e.g., 1.5x for emphasized areas).
 *
 * @param answers - User answers keyed by questionId
 * @param pillar - Pillar definition with sub-categories
 * @param allQuestions - All question definitions
 * @param visibleQuestionIds - Array of question IDs that should be included in scoring
 * @param emphasisMultipliers - Record mapping subcategoryId to multiplier (e.g., 1.5)
 * @returns ScoreResult with score (0-3), risk level, breakdown, and missing controls
 */
export function calculateCustomizedPillarScore(
  answers: Record<string, unknown>,
  pillar: Pillar,
  allQuestions: Question[],
  visibleQuestionIds: string[],
  emphasisMultipliers: Record<string, number>,
  // A2: optional configured cutoffs (same shape as calculatePillarScore).
  thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS
): ScoreResult {
  const categoryScores: CategoryScore[] = [];
  let totalWeightedScore = 0;
  let totalWeight = 0;

  // Filter questions to only those that should be included in scoring
  const questionsToScore = allQuestions.filter(q => visibleQuestionIds.includes(q.id));

  // Calculate score for each sub-category
  for (const subCategory of pillar.subCategories) {
    const categoryQuestions = questionsToScore.filter(
      q => q.subCategory === subCategory.id
    );

    // Skip subcategories that have no visible questions
    if (categoryQuestions.length === 0) {
      continue;
    }

    let categoryWeightedScore = 0;
    let categoryWeight = 0;

    // Calculate weighted average for this category (answered questions only)
    for (const question of categoryQuestions) {
      const answer = answers[question.id];

      // Skip unanswered questions
      if (answer === undefined || answer === null) {
        continue;
      }

      if (omitYesNoMaturityScore(question, answer)) {
        continue;
      }

      const maturityScore = normalizeAnswerToMaturity(question, answer);

      if (maturityScore !== undefined) {
        categoryWeightedScore += maturityScore * question.weight;
        categoryWeight += question.weight;
      }
    }

    // Calculate category score (0 if no questions answered)
    const categoryScore = categoryWeight > 0
      ? categoryWeightedScore / categoryWeight
      : 0;

    categoryScores.push({
      categoryId: subCategory.id,
      categoryName: subCategory.name,
      score: Math.round(categoryScore * 100) / 100, // Round to 2 decimals
      weight: subCategory.weight,
      maxScore: MATURITY_SCALE_MAX,
    });

    // Apply emphasis multiplier when accumulating for pillar score
    const multiplier = emphasisMultipliers[subCategory.id] ?? 1.0;
    totalWeightedScore += categoryScore * subCategory.weight * multiplier;
    totalWeight += subCategory.weight * multiplier;
  }

  // Calculate overall pillar score
  const pillarScore = totalWeight > 0
    ? totalWeightedScore / totalWeight
    : 0;

  // Determine risk level
  const riskLevel = getRiskLevel(pillarScore, thresholds);

  // Identify missing controls (only from visible questions)
  const missingControls = identifyMissingControls(answers, allQuestions, visibleQuestionIds);

  return {
    score: Math.round(pillarScore * 100) / 100, // Round to 2 decimals
    riskLevel,
    breakdown: categoryScores,
    missingControls,
  };
}

/**
 * Definitive remediation line for the action plan (prefer explicit remediation copy).
 */
function definitiveRemediationAction(question: Question): string {
  if (question.remediationAction) {
    return question.remediationAction;
  }
  if (question.learnMore) {
    return question.learnMore;
  }
  if (question.helpText) {
    return `Formalize and document: ${question.helpText}`;
  }
  return 'Establish a documented, communicated practice and review it on a defined cadence.';
}
