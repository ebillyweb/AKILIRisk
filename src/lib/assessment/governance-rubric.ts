/**
 * Family governance rubric (per BRD §4.2): per-question maturity 0–3 rolls up to a
 * 0–100 resilience score and tier classification (see client framework A–F weights).
 */

import type { RiskLevel } from "@/lib/assessment/types";
import { MATURITY_SCALE_MAX } from "@/lib/assessment/maturity-scale";

/** Target framework sections (for roadmap / content alignment; legacy bank uses six risk areas today). */
export const GOVERNANCE_FRAMEWORK_SECTIONS = [
  { code: "A" as const, name: "Family Governance & Decision-Making", weightPercent: 25 },
  { code: "B" as const, name: "Succession & Continuity Planning", weightPercent: 25 },
  { code: "C" as const, name: "Financial Discipline & Spending Governance", weightPercent: 15 },
  { code: "D" as const, name: "Reputation & Conduct Management", weightPercent: 15 },
  { code: "E" as const, name: "Marital & Relationship Governance", weightPercent: 10 },
  { code: "F" as const, name: "Education & Development Standard", weightPercent: 10 },
] as const;

/** Maturity column headers (0–3) aligned to rubric. */
export const MATURITY_LEVEL_LABELS = [
  "Critical gap (absent / unknown / informal only)",
  "Partial / informal (exists but undocumented, inconsistent, or person-dependent)",
  "Formalized (documented, communicated, and followed)",
  "Institutionalized (documented, tested, reviewed, and reinforced regularly)",
] as const;

/**
 * Convert aggregate maturity (0–3) to a 0–100 resilience score for tiering and reporting.
 */
export function maturityScoreToPercent(maturity03: number): number {
  if (maturity03 <= 0) return 0;
  return Math.min(100, Math.round((maturity03 / MATURITY_SCALE_MAX) * 100));
}

/**
 * A2 (BRD §4.2 + §7.1): risk-tier cutoffs in 0–100 resilience-percent space.
 *
 * `low/medium/high` are the three configurable cutoffs admins set at
 * /admin/scoring/thresholds. The fourth band ("critical") is implicit —
 * any score below `highMin` falls there. We keep four internal bands so
 * the existing `RiskLevel` enum, `GOVERNANCE_TIER_COPY`, PDF render code,
 * and recommendation engine continue to work unchanged.
 */
export interface RiskThresholds {
  /** Low (resilient) ≥ this percent. Default 80. */
  lowMin: number;
  /** Medium (moderate) ≥ this percent. Default 60. */
  mediumMin: number;
  /** High (elevated) ≥ this percent. Below this is critical. Default 40. */
  highMin: number;
}

/** Original hardcoded values — preserved as the default fallback so callers
 *  that don't have configured thresholds available behave identically to
 *  pre-A2. */
export const DEFAULT_RISK_THRESHOLDS: RiskThresholds = {
  lowMin: 80,
  mediumMin: 60,
  highMin: 40,
};

/**
 * Risk tier from 0–100 resilience score (BRD §4.2 bands; configurable via A2).
 *
 * Defensive: if thresholds aren't strictly monotonic (lowMin > mediumMin > highMin),
 * the cascade still produces a defined level — last-cutoff-wins via the if/else
 * order. The admin-side server action validates monotonicity before persisting,
 * so this is only reachable via direct misuse.
 */
export function riskLevelFromResiliencePercent(
  percent: number,
  thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS
): RiskLevel {
  if (percent >= thresholds.lowMin) return "low";
  if (percent >= thresholds.mediumMin) return "medium";
  if (percent >= thresholds.highMin) return "high";
  return "critical";
}

/** Tier classification from aggregate maturity (0–3). */
export function riskLevelFromMaturityScore(
  maturity03: number,
  thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS
): RiskLevel {
  return riskLevelFromResiliencePercent(maturityScoreToPercent(maturity03), thresholds);
}

export type GovernanceTierCopy = {
  title: string;
  description: string;
  requiredAction: string;
};

/** Client-facing labels (maps internal RiskLevel; HIGH = “Elevated” in rubric). */
export const GOVERNANCE_TIER_COPY: Record<RiskLevel, GovernanceTierCopy> = {
  low: {
    title: "Low Risk / Resilient",
    description: "Governance is durable across generations.",
    requiredAction: "Annual review; scenario testing.",
  },
  medium: {
    title: "Moderate Risk",
    description: "Gaps exist; manageable with targeted controls.",
    requiredAction: "Targeted governance remediation plan.",
  },
  high: {
    title: "Elevated Risk",
    description: "Structural weaknesses; likely conflict or disruption.",
    requiredAction: "Comprehensive governance redesign + advisor integration.",
  },
  critical: {
    title: "High / Critical Risk",
    description: "Governance failure likely under stress.",
    requiredAction: "Immediate CRO oversight; crisis & continuity controls.",
  },
};

export function governanceTierCopyForRiskLevel(riskLevel: RiskLevel): GovernanceTierCopy {
  return GOVERNANCE_TIER_COPY[riskLevel];
}

/** Progress / heat styling from 0–3 maturity. Shares thresholds with
 *  `riskLevelFromResiliencePercent` so the styling tier and the risk-tier
 *  label stay consistent ("Low risk" should never render with an orange
 *  progress bar after an admin moves the cutoffs). */
export function maturityHeatLevel(
  maturity03: number,
  thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS
): "strong" | "fair" | "weak" | "severe" {
  const p = maturityScoreToPercent(maturity03);
  if (p >= thresholds.lowMin) return "strong";
  if (p >= thresholds.mediumMin) return "fair";
  if (p >= thresholds.highMin) return "weak";
  return "severe";
}
