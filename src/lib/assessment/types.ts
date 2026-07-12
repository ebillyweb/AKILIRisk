/**
 * Assessment Domain Types
 *
 * Core type definitions for the Akili Risk assessment system.
 * Defines questions, scoring, branching logic, and results.
 */

import { HouseholdProfile } from './personalization';

// Question Types
export type QuestionType =
  | 'single-choice'
  | 'multi-choice'
  | 'yes-no'
  | 'maturity-scale'
  | 'likert'
  | 'numeric'
  | 'short-text'
  | 'document-upload'
  | 'date'
  | 'month-year';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

// Question Option
export interface QuestionOption {
  value: string | number;
  label: string;
  description?: string;
}

/** Serializable branching predicate (survives JSON API responses). */
export type BranchingPredicate = {
  op: "equals" | "notEquals" | "gte" | "answered";
  value?: unknown;
};

// Branching Rule
export interface BranchingRule {
  dependsOn: string; // questionId
  showIf: (answer: unknown) => boolean;
}

// Question Definition
export interface Question {
  id: string;
  text: string;
  helpText?: string;
  learnMore?: string;
  /** Definitive remediation step when this question scores in the remediation band (shown in action plan). */
  remediationAction?: string;
  /** “Why this matters” / risk relevance (rubric column). */
  riskRelevance?: string;
  type: QuestionType;
  options?: QuestionOption[];
  required: boolean;
  pillar: string;
  subCategory: string;
  weight: number;
  scoreMap: Record<string | number, number>;
  /**
   * Yes/no gates only: when true, answering "yes" does not enter the maturity rollup—follow-up
   * questions carry the 1–3 maturity. "no" is still scored via scoreMap (usually 0).
   */
  omitMaturityScoreWhenYes?: boolean;
  branchingRule?: BranchingRule;
  /** Wire-format parent id — used to rebuild `branchingRule` after JSON fetch. */
  branchingDependsOn?: string;
  branchingPredicate?: BranchingPredicate;
  textTemplate?: (profile: HouseholdProfile | null) => string;
  profileCondition?: (profile: HouseholdProfile) => boolean;
}

// Sub-Category Definition
export interface SubCategory {
  id: string;
  name: string;
  description: string;
  weight: number;
  questionIds: string[];
}

// Pillar Definition
export interface Pillar {
  id: string;
  name: string;
  slug: string;
  description: string;
  estimatedMinutes: number;
  subCategories: SubCategory[];
}

// Missing Control
export interface MissingControl {
  questionId: string;
  category: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  /** Definitive remediation step (same as recommendation; kept for clarity in UI copy). */
  recommendation: string;
  /** Rubric: why this gap matters. */
  riskRelevance?: string;
  /** Normalized maturity contribution for this answer (0–3 scale). */
  maturityScore?: number;
  /**
   * Weighted gap used to prioritize and sum remediation work: weight × (maturity max − maturityScore).
   */
  remediationPriority?: number;
}

// Category Score Breakdown
export interface CategoryScore {
  categoryId: string;
  categoryName: string;
  score: number;
  weight: number;
  /** Upper bound for category score display (maturity scale = 3). */
  maxScore: number;
}

// Score Result
export interface ScoreResult {
  score: number;
  riskLevel: RiskLevel;
  breakdown: CategoryScore[];
  missingControls: MissingControl[];
}
