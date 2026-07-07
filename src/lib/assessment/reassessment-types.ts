/**
 * Phase 24: Shared types for reassessment flow, score delta computation,
 * and review cadence management.
 */

/** D-01: Three reassessment scope types. */
export type ReassessmentType = "full" | "pillar" | "targeted";

/** Input for creating a new reassessment linked to a previous assessment. */
export type ReassessmentInput = {
  userId: string;
  previousAssessmentId: string;
  type: ReassessmentType;
  /** Selected pillars for "pillar" type. Empty/undefined = all pillars. */
  includedPillars?: string[];
  /** Question IDs for "targeted" type. */
  targetedQuestionIds?: string[];
};

/** Per-pillar score delta with attribution (D-05). */
export type PillarDelta = {
  pillar: string;
  previousScore: number;
  currentScore: number;
  /** Absolute delta: current - previous. Rounded to 2 decimal places. */
  delta: number;
  direction: "improved" | "regressed" | "unchanged";
  previousRiskLevel: string;
  currentRiskLevel: string;
  /** Names of completed recommendations attributed to this pillar's change.
   *  Empty pillars show ["No new planning activity"] per D-06. */
  attribution: string[];
};

/** Entry in a reassessment version chain (oldest-first). */
export type ReassessmentChainEntry = {
  id: string;
  /** Rescore counter (NOT reassessment version; derive from chain position). */
  version: number;
  status: string;
  completedAt: Date | null;
  createdAt: Date;
};
