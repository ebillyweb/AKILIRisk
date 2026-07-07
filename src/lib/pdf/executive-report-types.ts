/**
 * Phase 25: ExecutiveReportSnapshot type system and pure derivation functions.
 *
 * The ExecutiveReportSnapshot is the single frozen data contract consumed by
 * both the client-facing Executive Report PDF and the companion Advisor Brief
 * (D-01, D-19). It is populated by buildExecutiveReportSnapshot() and stored
 * in ExecutiveReport.executiveSnapshotData at publish time.
 *
 * Derivation functions are pure (no DB access) and operate only on the types
 * defined here. They are exported for direct unit testing.
 */

import type { PillarDelta } from "@/lib/assessment/reassessment-types";

// ---------------------------------------------------------------------------
// Sub-interfaces
// ---------------------------------------------------------------------------

/** Current-state posture for a single risk pillar. */
export interface PillarReadiness {
  pillar: string;
  /** Human-readable pillar label from the pillar catalog. */
  pillarLabel: string;
  score: number;
  /** Lowercase risk level string from PillarScore.riskLevel (e.g. "LOW", "HIGH"). */
  riskLevel: string;
  /** Qualitative impact level derived from recommendation urgency + pillar weight (D-26, D-27). */
  impactLevel: "Critical" | "High" | "Medium" | "Low";
}

/** Per-pillar score delta summary including WHY attribution (D-12, D-13). */
export interface ScoreDeltaSummary {
  /** Per-pillar deltas with attribution from completed recommendations. */
  deltas: PillarDelta[];
  /** Aggregate direction across all pillars. */
  overallDirection: "improved" | "regressed" | "mixed" | "unchanged";
  /** Top 3-5 attribution items surfaced across all pillars. */
  keyDrivers: string[];
}

/** Recommendation status counts for the reporting period. */
export interface RecommendationSummary {
  total: number;
  completed: number;
  inProgress: number;
  deferred: number;
  open: number;
  /** completed / (total - deferred), clamped to [0, 100]. */
  completionPct: number;
}

/** Per-client milestone engagement summary (conditional -- requires published action plan). */
export interface EngagementSummary {
  milestoneCompletionPct: number;
  totalMilestones: number;
  completedMilestones: number;
  overdueMilestones: number;
}

/** Single high-priority open or in-progress recommendation (D-05). */
export interface TopPriorityItem {
  name: string;
  category: string;
  impactLevel: "Critical" | "High" | "Medium" | "Low";
  status: string;
}

/** Single intelligence / activity event for the timeline excerpt (D-06). */
export interface IntelligenceEvent {
  action: string;
  label: string;
  /** ISO date string of when the event occurred. */
  occurredAt: string;
}

/** Derived Executive Readiness tier output (D-10). */
export interface ExecutiveReadinessTier {
  tier: "Developing" | "Mature" | "Advanced";
  /** Pillar labels with CRITICAL or HIGH risk level, sorted by score ascending. */
  highestRiskDomains: string[];
  /** Pillar labels with LOW risk level, sorted by score descending. */
  strongestDomains: string[];
  /** Derived strategic priority strings for each highest-risk domain. */
  strategicPriorities: string[];
}

// ---------------------------------------------------------------------------
// Root snapshot interface
// ---------------------------------------------------------------------------

/**
 * Frozen data contract for an ExecutiveReport.
 *
 * schemaVersion: 1 enables future migration paths without breaking stored rows.
 *
 * advisorNotes / meetingAgenda / discussionPrompts are populated from the
 * ExecutiveReport row's editorial fields at publish time. During snapshot
 * assembly (buildExecutiveReportSnapshot) these are null -- they are merged
 * in by the publish action before storing executiveSnapshotData.
 *
 * Render-time variant selection (client vs advisor brief) is a parameter
 * passed to the render function, NOT a field in the snapshot (D-17, D-19,
 * Pitfall 2 in research).
 */
export interface ExecutiveReportSnapshot {
  schemaVersion: 1;
  reportingPeriod: {
    /** ISO date string for the start of the reporting window. */
    start: string;
    /** ISO date string for the end of the reporting window. */
    end: string;
    /** Human-readable label, e.g. "January 1, 2026 - June 27, 2026" (D-24). */
    label: string;
  };
  clientName: string;
  /** ISO datetime string of when the snapshot was assembled. */
  generatedAt: string;

  /** Per-pillar current state (D-09). Always populated when assessments exist. */
  pillarReadiness: PillarReadiness[];

  /** Executive Readiness tier derived from per-pillar risk levels (D-10, D-09). */
  executiveReadiness: ExecutiveReadinessTier;

  /** Score deltas vs previous assessment. Null when no previous assessment exists (D-06, D-07). */
  scoreDelta: ScoreDeltaSummary | null;

  /** Recommendation status counts for the reporting period (D-05). */
  recommendationSummary: RecommendationSummary;

  /** Milestone engagement summary. Null when no action plan has been published (D-06). */
  engagementSummary: EngagementSummary | null;

  /** Top 5 open/in-progress recommendations by impact level (D-05). */
  topPriorities: TopPriorityItem[];

  /** Intelligence timeline excerpt: last 10 activity events (D-06). */
  intelligenceExcerpt: IntelligenceEvent[];

  /** Advisor-derived next recommended steps (D-05). */
  nextSteps: string[];

  /** Advisor-authored overlay fields. Null during snapshot assembly;
   *  merged in from ExecutiveReport row at publish time (D-18). */
  advisorNotes: string | null;
  meetingAgenda: string | null;
  discussionPrompts: string[];

  /** All assessment IDs included in the reporting window scope. */
  assessmentIds: string[];
  /** Most recent assessment ID (drives per-pillar current state). */
  currentAssessmentId: string;
  /** Previous assessment ID for delta computation. Null = first report (D-22). */
  previousAssessmentId: string | null;
}

// ---------------------------------------------------------------------------
// Pure derivation functions
// ---------------------------------------------------------------------------

/**
 * Derive the Executive Readiness tier from per-pillar risk levels (D-10).
 *
 * Algorithm (Claude's Discretion per CONTEXT.md):
 * - "Developing": any CRITICAL risk level OR 2+ HIGH risk levels
 * - "Advanced":   60%+ of pillars at LOW risk level
 * - "Mature":     everything else
 *
 * No composite score is computed (D-09). The tier communicates overall posture
 * without false mathematical precision.
 */
export function deriveExecutiveReadiness(
  pillars: PillarReadiness[],
): ExecutiveReadinessTier {
  if (pillars.length === 0) {
    return {
      tier: "Developing",
      highestRiskDomains: [],
      strongestDomains: [],
      strategicPriorities: [],
    };
  }

  const criticalCount = pillars.filter(
    (p) => p.riskLevel.toUpperCase() === "CRITICAL",
  ).length;
  const highCount = pillars.filter(
    (p) => p.riskLevel.toUpperCase() === "HIGH",
  ).length;
  const lowCount = pillars.filter(
    (p) => p.riskLevel.toUpperCase() === "LOW",
  ).length;

  let tier: ExecutiveReadinessTier["tier"];
  if (criticalCount > 0 || highCount >= 2) {
    tier = "Developing";
  } else if (lowCount >= Math.ceil(pillars.length * 0.6)) {
    tier = "Advanced";
  } else {
    tier = "Mature";
  }

  // Highest-risk domains: CRITICAL or HIGH, sorted by score ascending (worst first)
  const highestRiskDomains = pillars
    .filter(
      (p) =>
        p.riskLevel.toUpperCase() === "CRITICAL" ||
        p.riskLevel.toUpperCase() === "HIGH",
    )
    .sort((a, b) => a.score - b.score)
    .map((p) => p.pillarLabel);

  // Strongest domains: LOW risk level, sorted by score descending (best first)
  const strongestDomains = pillars
    .filter((p) => p.riskLevel.toUpperCase() === "LOW")
    .sort((a, b) => b.score - a.score)
    .map((p) => p.pillarLabel);

  // Strategic priorities derived from highest-risk domains
  const strategicPriorities = highestRiskDomains.map(
    (label) => `Address ${label} risk exposure`,
  );

  return { tier, highestRiskDomains, strongestDomains, strategicPriorities };
}

/**
 * Derive qualitative impact level from recommendation urgency score and pillar weight (D-27).
 *
 * Algorithm (Claude's Discretion per CONTEXT.md):
 *   composite = urgencyScore * (pillarWeight / 16)
 *   >= 7   -> Critical
 *   >= 5   -> High
 *   >= 3   -> Medium
 *   < 3    -> Low
 *
 * urgencyScore: 1-10 from AssessmentRecommendation.urgencyScore
 * pillarWeight: from PILLAR_WEIGHTS map in build-executive-report-snapshot.ts (max 16)
 */
export function deriveImpactLevel(
  urgencyScore: number,
  pillarWeight: number,
): "Critical" | "High" | "Medium" | "Low" {
  const composite = urgencyScore * (pillarWeight / 16);
  if (composite >= 7) return "Critical";
  if (composite >= 5) return "High";
  if (composite >= 3) return "Medium";
  return "Low";
}
