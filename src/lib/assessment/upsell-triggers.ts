/**
 * BRD §6.2 / Epic 5.10 — Upsell-trigger evaluator.
 *
 * An upsell trigger marks an assessment as warranting remediation outreach.
 * Triggers fire on three signal types:
 *   - score_threshold — overall or per-pillar resilience % below cutoff
 *   - domain_flag     — a pillar classified into the Critical risk tier
 *   - kri             — a Key Risk Indicator question answered at a
 *                       failing maturity level (≤ 1)
 *
 * The evaluator is pure: deterministic given the same inputs. Persist its
 * result on `Assessment.upsellTriggersFired` at report-publish time (or
 * re-score time) so downstream UI banners and notifications consult the
 * stored snapshot rather than re-running the evaluation.
 */

export type UpsellTriggerCode = string;

export interface PillarScoreInput {
  /** 0–100 resilience percentage. */
  resilience: number;
  /** Lower-case risk-tier label as stored on `PillarScore.riskLevel`. */
  riskLevel: "low" | "medium" | "high" | "critical";
}

export interface TriggerEvaluationInput {
  /** Overall household resilience %, if computed. Optional today. */
  overallResilience?: number;
  /** Pillar scores keyed by canonical pillar id (see ASSESSMENT_PILLAR_IDS). */
  pillarScores: Record<string, PillarScoreInput>;
  /** Question ids of KRI-flagged questions that scored at maturity ≤ 1. */
  kriHits: readonly string[];
}

export interface UpsellTriggerThresholds {
  /** Fires `score_threshold:overall` when overallResilience ≤ this value. */
  overallResilienceMax: number;
  /** Fires `score_threshold:<pillarId>` when a pillar resilience ≤ this value. */
  pillarResilienceMax: number;
}

/**
 * Platform defaults. Super-admin override surface (BR-06 pattern) is a
 * follow-up; until that ships these constants are the effective policy.
 */
export const DEFAULT_UPSELL_TRIGGER_THRESHOLDS: UpsellTriggerThresholds = {
  overallResilienceMax: 60,
  pillarResilienceMax: 60,
};

/** Pure evaluator. Returns a stable, sorted list of fired trigger codes. */
export function evaluateUpsellTriggers(
  input: TriggerEvaluationInput,
  thresholds: UpsellTriggerThresholds = DEFAULT_UPSELL_TRIGGER_THRESHOLDS
): UpsellTriggerCode[] {
  const fired = new Set<UpsellTriggerCode>();

  if (
    input.overallResilience !== undefined &&
    input.overallResilience <= thresholds.overallResilienceMax
  ) {
    fired.add("score_threshold:overall");
  }

  for (const [pillarId, p] of Object.entries(input.pillarScores)) {
    if (p.resilience <= thresholds.pillarResilienceMax) {
      fired.add(`score_threshold:${pillarId}`);
    }
    if (p.riskLevel === "critical") {
      fired.add(`domain_flag:${pillarId}`);
    }
  }

  for (const questionId of input.kriHits) {
    fired.add(`kri:${questionId}`);
  }

  return [...fired].sort();
}

/** True when at least one upsell trigger fired. Used by dashboards / banners. */
export function hasFiredUpsellTrigger(
  triggers: readonly UpsellTriggerCode[] | null | undefined
): boolean {
  return Array.isArray(triggers) && triggers.length > 0;
}
