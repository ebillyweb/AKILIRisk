/**
 * Phase 25: ExecutiveReportSnapshot assembler.
 *
 * Joins data from multiple sources -- completed assessments, pillar scores,
 * recommendation guidance package, engagement metrics, intelligence timeline,
 * and review cadence -- into a single frozen ExecutiveReportSnapshot object.
 *
 * This is a pure read-only function. No Prisma writes. All side effects
 * (storing the snapshot, audit logging) live at the action layer.
 *
 * N+1 guard (Pitfall 1): all assessment IDs are collected up front, then
 * all dependent queries use { in: assessmentIds } rather than per-assessment
 * loops.
 *
 * Caller responsibility (T-25-01): callers (server actions) must verify the
 * advisorProfileId has an ACTIVE ClientAdvisorAssignment for the clientId
 * before invoking this function. The builder itself is a pure data assembler
 * with no auth checks.
 */

import "server-only";

import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { computePillarDeltas } from "@/lib/analytics/score-delta";
import { getGuidancePackageForClient } from "@/lib/recommendations/guidance-package";
import { getEngagementClients } from "@/lib/engagement/engagement-metrics";
import {
  deriveExecutiveReadiness,
  deriveImpactLevel,
  type ExecutiveReportSnapshot,
  type PillarReadiness,
  type ScoreDeltaSummary,
  type RecommendationSummary,
  type EngagementSummary,
  type TopPriorityItem,
  type IntelligenceEvent,
} from "@/lib/pdf/executive-report-types";
import type { PillarDelta } from "@/lib/assessment/reassessment-types";

// ---------------------------------------------------------------------------
// Pillar weights (Claude's Discretion, max weight = 16)
// Uniform weight of 8 used until platform pillar catalog exposes weights.
// ---------------------------------------------------------------------------

const DEFAULT_PILLAR_WEIGHT = 8;
const PILLAR_WEIGHTS: Record<string, number> = {
  governance: 10,
  ownership: 9,
  succession: 9,
  estate: 8,
  cyber: 12,
  identity: 10,
  physical: 8,
  reputation: 7,
  financial: 10,
  family: 7,
};

function getPillarWeight(pillar: string): number {
  return PILLAR_WEIGHTS[pillar.toLowerCase()] ?? DEFAULT_PILLAR_WEIGHT;
}

// ---------------------------------------------------------------------------
// PILLAR_LABELS: human-readable labels for known pillar slugs
// ---------------------------------------------------------------------------

const PILLAR_LABELS: Record<string, string> = {
  governance: "Governance",
  ownership: "Ownership",
  succession: "Succession",
  estate: "Estate Planning",
  cyber: "Cybersecurity",
  identity: "Identity Protection",
  physical: "Physical Security",
  reputation: "Reputation",
  financial: "Financial",
  family: "Family Risk",
};

function getPillarLabel(pillar: string): string {
  return PILLAR_LABELS[pillar.toLowerCase()] ?? pillar;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BuildExecutiveReportSnapshotOptions {
  /** Explicit reporting window end. Defaults to now(). */
  periodEnd?: Date;
  /** Explicit reporting window start. Overrides the "since last published" default (D-23). */
  periodStart?: Date;
}

// ---------------------------------------------------------------------------
// Main assembler
// ---------------------------------------------------------------------------

/**
 * Assemble an ExecutiveReportSnapshot for the given (clientId, advisorProfileId) pair.
 *
 * Default reporting window (D-22):
 * - end: options.periodEnd ?? now()
 * - start: reportingPeriodEnd of the last PUBLISHED ExecutiveReport for this pair,
 *   or earliest assessment.startedAt when no prior published report exists (first-ever report).
 *
 * Returns the snapshot with advisorNotes / meetingAgenda / discussionPrompts as null.
 * The publish action merges those from the ExecutiveReport row before persisting
 * executiveSnapshotData.
 */
export async function buildExecutiveReportSnapshot(
  clientId: string,
  advisorProfileId: string,
  options: BuildExecutiveReportSnapshotOptions = {},
): Promise<ExecutiveReportSnapshot> {
  const periodEnd = options.periodEnd ?? new Date();

  // ── Batch queries (Pitfall 1: no per-assessment loops) ──────────────────
  const [
    assessments,
    lastPublishedReport,
    guidancePackage,
    engagementClientRows,
  ] = await Promise.all([
    // All completed assessments for this client within the reporting window
    prisma.assessment.findMany({
      where: {
        userId: clientId,
        status: "COMPLETED",
        completedAt: { lte: periodEnd },
      },
      include: {
        scores: {
          select: { pillar: true, score: true, riskLevel: true },
        },
      },
      orderBy: { completedAt: "asc" },
    }),

    // Last PUBLISHED ExecutiveReport for default period start (D-22)
    prisma.executiveReport.findFirst({
      where: {
        clientId,
        advisorProfileId,
        status: "PUBLISHED",
      },
      orderBy: { publishedAt: "desc" },
      select: { reportingPeriodEnd: true },
    }),

    // Per-client recommendation guidance package
    getGuidancePackageForClient(clientId, advisorProfileId),

    // Per-advisor engagement clients (filtered to this client below)
    getEngagementClients(advisorProfileId),
  ]);

  // ── Determine reporting period start ────────────────────────────────────
  let periodStart: Date;
  if (options.periodStart) {
    periodStart = options.periodStart;
  } else if (lastPublishedReport) {
    // Default: since last published report (D-22)
    periodStart = lastPublishedReport.reportingPeriodEnd;
  } else if (assessments.length > 0) {
    // First-ever report: cover all time from earliest assessment (D-22)
    periodStart = assessments[0].startedAt;
  } else {
    // Fallback: no assessments, use 365 days ago
    periodStart = new Date(periodEnd.getTime() - 365 * 24 * 60 * 60 * 1000);
  }

  // ── Assessment chain ─────────────────────────────────────────────────────
  const assessmentIds = assessments.map((a) => a.id);

  // Current assessment = most recent completed assessment
  const currentAssessment = assessments[assessments.length - 1] ?? null;
  if (!currentAssessment) {
    // No assessments: return a minimal zero-state snapshot
    return buildZeroStateSnapshot(clientId, periodStart, periodEnd);
  }

  // Previous assessment: find the assessment linked via previousAssessmentId
  const currentWithPrevious = await prisma.assessment.findUnique({
    where: { id: currentAssessment.id },
    select: {
      previousAssessmentId: true,
      user: { select: { name: true } },
    },
  });

  const clientName = currentWithPrevious?.user?.name ?? "Client";
  const previousAssessmentId =
    currentWithPrevious?.previousAssessmentId ?? null;

  // Fetch intelligence timeline excerpt (last 10 activity events in scope)
  const solutionActivities =
    assessmentIds.length > 0
      ? await prisma.solutionActivity.findMany({
          where: {
            assessmentRecommendation: {
              assessmentId: { in: assessmentIds },
            },
            createdAt: { gte: periodStart, lte: periodEnd },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            action: true,
            label: true,
            createdAt: true,
          },
        })
      : [];

  // Fetch review cadence for next-steps derivation
  const reviewCadence = await prisma.reviewCadence.findFirst({
    where: { clientId, advisorProfileId },
    select: { nextDueDate: true },
  });

  // ── Pillar readiness ─────────────────────────────────────────────────────
  const currentScores = currentAssessment.scores;

  const pillarReadiness: PillarReadiness[] = currentScores.map((score) => {
    // Use guidance package to find the highest-urgency recommendation for this pillar
    const pillarRecs = guidancePackage.items.filter(
      (item) =>
        item.category === score.pillar ||
        item.category.toLowerCase() === score.pillar.toLowerCase(),
    );
    const maxUrgency = pillarRecs.reduce(
      (max, item) => {
        // urgencyScore is a number field from the guidance package item
        const urgency =
          (item as unknown as { urgencyScore?: number }).urgencyScore ?? 5;
        return Math.max(max, urgency);
      },
      5, // default urgency when no recommendations
    );

    return {
      pillar: score.pillar,
      pillarLabel: getPillarLabel(score.pillar),
      score: score.score,
      riskLevel: score.riskLevel,
      impactLevel: deriveImpactLevel(maxUrgency, getPillarWeight(score.pillar)),
    };
  });

  // ── Executive readiness ──────────────────────────────────────────────────
  const executiveReadiness = deriveExecutiveReadiness(pillarReadiness);

  // ── Score deltas ─────────────────────────────────────────────────────────
  let scoreDelta: ScoreDeltaSummary | null = null;

  if (previousAssessmentId) {
    const previousAssessment = await prisma.assessment.findUnique({
      where: { id: previousAssessmentId },
      select: {
        scores: { select: { pillar: true, score: true, riskLevel: true } },
      },
    });

    if (previousAssessment) {
      // Completed recommendations for attribution (D-13)
      const completedRecs = guidancePackage.items
        .filter((item) => item.status === "COMPLETED")
        .map((item) => ({
          pillar: item.category,
          name: item.serviceName,
        }));

      const deltas: PillarDelta[] = computePillarDeltas(
        previousAssessment.scores,
        currentScores,
        completedRecs,
      );

      // Compute overall direction from per-pillar directions
      const improved = deltas.filter((d) => d.direction === "improved").length;
      const regressed = deltas.filter(
        (d) => d.direction === "regressed",
      ).length;
      const unchanged = deltas.filter(
        (d) => d.direction === "unchanged",
      ).length;

      let overallDirection: ScoreDeltaSummary["overallDirection"];
      if (improved > 0 && regressed === 0) {
        overallDirection = "improved";
      } else if (regressed > 0 && improved === 0) {
        overallDirection = "regressed";
      } else if (improved === 0 && regressed === 0 && unchanged > 0) {
        overallDirection = "unchanged";
      } else {
        overallDirection = "mixed";
      }

      // Key drivers: top 3-5 attribution items across all pillars
      const allAttribution = deltas
        .flatMap((d) => d.attribution)
        .filter((a) => a !== "No new planning activity");
      const keyDrivers = [...new Set(allAttribution)].slice(0, 5);

      scoreDelta = { deltas, overallDirection, keyDrivers };
    }
  }

  // ── Recommendation summary ───────────────────────────────────────────────
  const { summary } = guidancePackage;
  const open =
    summary.totalItems -
    summary.completedCount -
    summary.inProgressCount -
    summary.deferredCount -
    summary.hiddenCount;

  const denominator = summary.totalItems - summary.deferredCount;
  const completionPct =
    denominator > 0
      ? Math.round((summary.completedCount / denominator) * 100)
      : 0;

  const recommendationSummary: RecommendationSummary = {
    total: summary.totalItems,
    completed: summary.completedCount,
    inProgress: summary.inProgressCount,
    deferred: summary.deferredCount,
    open: Math.max(0, open),
    completionPct,
  };

  // ── Engagement summary ───────────────────────────────────────────────────
  let engagementSummary: EngagementSummary | null = null;
  const clientEngagement = engagementClientRows.find(
    (row) => row.clientId === clientId,
  );
  if (clientEngagement && clientEngagement.totalCount > 0) {
    // overdueMilestones not available from EngagementClientRow; default to 0
    engagementSummary = {
      milestoneCompletionPct: clientEngagement.completionPct,
      totalMilestones: clientEngagement.totalCount,
      completedMilestones: clientEngagement.completedCount,
      overdueMilestones: 0,
    };
  }

  // ── Top priorities ───────────────────────────────────────────────────────
  const impactOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  const openItems = guidancePackage.items.filter(
    (item) =>
      item.status === "INCLUDED" ||
      item.status === "IN_PROGRESS" ||
      item.status === "GENERATED",
  );

  // Build top priority items with derived impact levels
  const topPriorities: TopPriorityItem[] = openItems
    .map((item) => {
      const urgency =
        (item as unknown as { urgencyScore?: number }).urgencyScore ?? 5;
      const impactLevel = deriveImpactLevel(
        urgency,
        getPillarWeight(item.category),
      );
      return {
        name: item.serviceName,
        category: item.category,
        impactLevel,
        status: item.status,
      };
    })
    .sort((a, b) => impactOrder[a.impactLevel] - impactOrder[b.impactLevel])
    .slice(0, 5);

  // ── Intelligence excerpt ─────────────────────────────────────────────────
  const intelligenceExcerpt: IntelligenceEvent[] = solutionActivities.map(
    (activity) => ({
      action: activity.action,
      label: activity.label ?? activity.action,
      occurredAt: activity.createdAt.toISOString(),
    }),
  );

  // ── Next steps ───────────────────────────────────────────────────────────
  const nextSteps: string[] = [];

  // Derive from top priorities
  const criticalPriorities = topPriorities.filter(
    (p) => p.impactLevel === "Critical",
  );
  if (criticalPriorities.length > 0) {
    nextSteps.push(
      `Address critical risk: ${criticalPriorities[0].name} (${criticalPriorities[0].category})`,
    );
  }

  if (executiveReadiness.tier === "Developing") {
    nextSteps.push(
      `Focus remediation on highest-risk domains: ${executiveReadiness.highestRiskDomains.slice(0, 2).join(", ")}`,
    );
  }

  if (reviewCadence?.nextDueDate) {
    nextSteps.push(
      `Schedule reassessment by ${format(reviewCadence.nextDueDate, "MMMM d, yyyy")}`,
    );
  }

  if (nextSteps.length === 0) {
    nextSteps.push("Continue monitoring risk posture across all domains");
  }

  // ── Reporting period label ───────────────────────────────────────────────
  const periodLabel = `${format(periodStart, "MMMM d, yyyy")} - ${format(periodEnd, "MMMM d, yyyy")}`;

  // ── Assemble snapshot ────────────────────────────────────────────────────
  return {
    schemaVersion: 1,
    reportingPeriod: {
      start: periodStart.toISOString(),
      end: periodEnd.toISOString(),
      label: periodLabel,
    },
    clientName,
    generatedAt: new Date().toISOString(),
    pillarReadiness,
    executiveReadiness,
    scoreDelta,
    recommendationSummary,
    engagementSummary,
    topPriorities,
    intelligenceExcerpt,
    nextSteps,
    advisorNotes: null,
    meetingAgenda: null,
    discussionPrompts: [],
    assessmentIds,
    currentAssessmentId: currentAssessment.id,
    previousAssessmentId,
  };
}

// ---------------------------------------------------------------------------
// Zero-state snapshot for clients with no completed assessments
// ---------------------------------------------------------------------------

async function buildZeroStateSnapshot(
  clientId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<ExecutiveReportSnapshot> {
  const user = await prisma.user.findUnique({
    where: { id: clientId },
    select: { name: true },
  });

  const periodLabel = `${format(periodStart, "MMMM d, yyyy")} - ${format(periodEnd, "MMMM d, yyyy")}`;

  return {
    schemaVersion: 1,
    reportingPeriod: {
      start: periodStart.toISOString(),
      end: periodEnd.toISOString(),
      label: periodLabel,
    },
    clientName: user?.name ?? "Client",
    generatedAt: new Date().toISOString(),
    pillarReadiness: [],
    executiveReadiness: {
      tier: "Developing",
      highestRiskDomains: [],
      strongestDomains: [],
      strategicPriorities: [],
    },
    scoreDelta: null,
    recommendationSummary: {
      total: 0,
      completed: 0,
      inProgress: 0,
      deferred: 0,
      open: 0,
      completionPct: 0,
    },
    engagementSummary: null,
    topPriorities: [],
    intelligenceExcerpt: [],
    nextSteps: ["Complete initial risk assessment to enable executive reporting"],
    advisorNotes: null,
    meetingAgenda: null,
    discussionPrompts: [],
    assessmentIds: [],
    currentAssessmentId: "",
    previousAssessmentId: null,
  };
}
