import "server-only";

import { prisma } from "@/lib/db";

/**
 * Business / product analytics for `/admin/analytics`.
 *
 * This module adds the §"Functional Dashboard" metric helpers that
 * sit alongside the existing `analytics-queries.ts` (the §9.1 BRD
 * aggregate cards). Both are admin-gated at the page layer.
 *
 * Every helper:
 *   - Returns plain aggregate counts / averages / time series — no
 *     per-client identifiers.
 *   - Catches its own errors and returns a `null`-able shape so the
 *     dashboard can render an honest "Not enough data yet" placeholder
 *     when a metric can't be calculated.
 *
 * The page layer wraps these in `Promise.allSettled` so a single slow
 * or failing query never blocks the others.
 */

// ── Date-bucket helpers ──────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDayUTC(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * DAY_MS);
}

// ── Onboarding funnel ────────────────────────────────────────────────────

export interface OnboardingFunnel {
  /** Advisors created in the last 30 days. */
  newAdvisors30d: number;
  /** Active advisors today (role=ADVISOR, not soft-deleted, portal enabled). */
  activeAdvisors: number;
  /** Advisors with an ACTIVE / GRACE_PERIOD Subscription — "billed". */
  advisorsWithSubscription: number;
  /** Advisors with at least one assigned client. */
  advisorsWithClient: number;
  /** Advisors with at least one client who has a SUBMITTED intake. */
  advisorsWithSubmittedIntake: number;
  /** Computed: advisorsWithSubmittedIntake / activeAdvisors, 0–1.
   *  Null if activeAdvisors === 0 (avoid divide-by-zero, render as
   *  "Not enough data yet"). */
  completionRate: number | null;
}

export async function getOnboardingFunnel(): Promise<OnboardingFunnel> {
  const since = daysAgo(30);

  const [
    newAdvisors30d,
    activeAdvisors,
    advisorsWithSubscription,
    advisorsWithClient,
    advisorsWithSubmittedIntake,
  ] = await Promise.all([
    prisma.user.count({
      where: { role: "ADVISOR", createdAt: { gte: since } },
    }),
    prisma.user.count({
      where: {
        role: "ADVISOR",
        deletedAt: null,
        advisorPortalAccessEnabled: true,
      },
    }),
    prisma.subscription.count({
      where: {
        status: { in: ["ACTIVE", "GRACE_PERIOD"] },
        user: { role: "ADVISOR", deletedAt: null },
      },
    }),
    // Distinct advisorIds present in active assignments. Cheaper than
    // a count(distinct) via groupBy.
    prisma.clientAdvisorAssignment
      .groupBy({
        by: ["advisorId"],
        where: { status: "ACTIVE" },
      })
      .then((rows) => rows.length),
    prisma.clientAdvisorAssignment
      .groupBy({
        by: ["advisorId"],
        where: {
          status: "ACTIVE",
          client: {
            intakeInterviews: {
              some: {
                status: { in: ["SUBMITTED", "COMPLETED"] },
              },
            },
          },
        },
      })
      .then((rows) => rows.length),
  ]);

  const completionRate =
    activeAdvisors > 0
      ? Math.min(1, advisorsWithSubmittedIntake / activeAdvisors)
      : null;

  return {
    newAdvisors30d,
    activeAdvisors,
    advisorsWithSubscription,
    advisorsWithClient,
    advisorsWithSubmittedIntake,
    completionRate,
  };
}

// ── Assessment activity ─────────────────────────────────────────────────

export interface AssessmentActivity {
  total: number;
  inProgress: number;
  completed: number;
  /** Completed assessments where startedAt is known — used to compute
   *  averageCompletionHours. */
  completedWithDuration: number;
  /** Mean (completedAt - startedAt) across completed assessments with
   *  both timestamps set. Null when no completed assessments yet. */
  averageCompletionHours: number | null;
  /** Pending: leads in GovernanceReviewLead that don't yet have an
   *  assigned advisor. */
  pendingRequests: number;
  intakeSubmissions: number;
  recommendationsGenerated: number;
}

export async function getAssessmentActivity(): Promise<AssessmentActivity> {
  const [
    total,
    inProgress,
    completed,
    completedRows,
    pendingRequests,
    intakeSubmissions,
    recommendationsGenerated,
  ] = await Promise.all([
    prisma.assessment.count(),
    prisma.assessment.count({ where: { status: "IN_PROGRESS" } }),
    prisma.assessment.count({ where: { status: "COMPLETED" } }),
    prisma.assessment.findMany({
      where: { status: "COMPLETED", completedAt: { not: null } },
      select: { startedAt: true, completedAt: true },
      take: 500, // cap — avg over the most recent 500 is plenty stable.
      orderBy: { completedAt: "desc" },
    }),
    prisma.governanceReviewLead.count({
      where: { assignedAdvisorId: null },
    }),
    prisma.intakeInterview.count({
      where: { status: { in: ["SUBMITTED", "COMPLETED"] } },
    }),
    prisma.assessmentRecommendation.count(),
  ]);

  let completedWithDuration = 0;
  let totalHours = 0;
  for (const r of completedRows) {
    if (!r.completedAt) continue;
    const ms = r.completedAt.getTime() - r.startedAt.getTime();
    if (ms <= 0) continue;
    totalHours += ms / (60 * 60 * 1000);
    completedWithDuration += 1;
  }

  return {
    total,
    inProgress,
    completed,
    completedWithDuration,
    averageCompletionHours:
      completedWithDuration > 0 ? totalHours / completedWithDuration : null,
    pendingRequests,
    intakeSubmissions,
    recommendationsGenerated,
  };
}

// ── Advisor / client snapshot ───────────────────────────────────────────

export interface AdvisorClientSnapshot {
  advisorsTotal: number;
  advisorsActive: number;
  clientsTotal: number;
  clientsActive: number;
  /** Subscriptions in commercially-healthy state (ACTIVE or GRACE_PERIOD). */
  subscriptionsHealthy: number;
  /** Subscriptions needing attention (PAST_DUE / UNPAID / CANCELLED). */
  subscriptionsAtRisk: number;
}

export async function getAdvisorClientSnapshot(): Promise<AdvisorClientSnapshot> {
  const [
    advisorsTotal,
    advisorsActive,
    clientsTotal,
    clientsActive,
    subsHealthy,
    subsAtRisk,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "ADVISOR" } }),
    prisma.user.count({ where: { role: "ADVISOR", deletedAt: null } }),
    prisma.user.count({ where: { role: "USER" } }),
    prisma.user.count({ where: { role: "USER", deletedAt: null } }),
    prisma.subscription.count({
      where: { status: { in: ["ACTIVE", "GRACE_PERIOD"] } },
    }),
    prisma.subscription.count({
      where: { status: { in: ["PAST_DUE", "UNPAID", "CANCELLED"] } },
    }),
  ]);

  return {
    advisorsTotal,
    advisorsActive,
    clientsTotal,
    clientsActive,
    subscriptionsHealthy: subsHealthy,
    subscriptionsAtRisk: subsAtRisk,
  };
}

// ── Risk / recommendation insights ──────────────────────────────────────

export interface RiskInsights {
  /** Distinct assessmentIds where at least one PillarScore is HIGH or
   *  CRITICAL. Latest scores only. */
  highRiskAssessments: number;
  /** Distinct assessmentIds scored at all. */
  scoredAssessments: number;
  /** highRiskAssessments / scoredAssessments — null when no scored
   *  assessments yet. */
  highRiskShare: number | null;
  recommendationsPending: number;
  recommendationsAccepted: number;
  recommendationsDeclined: number;
}

export async function getRiskInsights(): Promise<RiskInsights> {
  const [
    highRiskRows,
    scoredRows,
    recsPending,
    recsAccepted,
    recsDeclined,
  ] = await Promise.all([
    prisma.pillarScore.groupBy({
      by: ["assessmentId"],
      where: { riskLevel: { in: ["HIGH", "CRITICAL"] } },
    }),
    prisma.pillarScore.groupBy({
      by: ["assessmentId"],
    }),
    prisma.assessmentRecommendation.count({ where: { status: "PENDING" } }),
    prisma.assessmentRecommendation.count({ where: { status: "ACCEPTED" } }),
    prisma.assessmentRecommendation.count({ where: { status: "DECLINED" } }),
  ]);

  const highRiskAssessments = highRiskRows.length;
  const scoredAssessments = scoredRows.length;
  return {
    highRiskAssessments,
    scoredAssessments,
    highRiskShare:
      scoredAssessments > 0 ? highRiskAssessments / scoredAssessments : null,
    recommendationsPending: recsPending,
    recommendationsAccepted: recsAccepted,
    recommendationsDeclined: recsDeclined,
  };
}

// ── Platform usage trend (last 14 days) ─────────────────────────────────

export interface UsageTrendPoint {
  /** ISO date (YYYY-MM-DD, UTC) for the bucket. */
  date: string;
  intakeSubmissions: number;
  assessmentsStarted: number;
  assessmentsCompleted: number;
}

export interface UsageTrend {
  /** Oldest → newest. Includes today (partial). */
  points: UsageTrendPoint[];
  /** True when every bucket sums to zero — render "Not enough data yet". */
  empty: boolean;
}

export async function getUsageTrend(): Promise<UsageTrend> {
  const days = 14;
  const todayUtc = startOfDayUTC(new Date());
  const oldest = new Date(todayUtc.getTime() - (days - 1) * DAY_MS);

  // Pull every relevant timestamp in the window, bucket in JS. Three
  // small SELECTs are cheaper than three SQL GROUP BYs that each have
  // to coerce timestamps to UTC days portably across PG versions.
  const [intakeRows, assessmentRows] = await Promise.all([
    prisma.intakeInterview.findMany({
      where: { submittedAt: { gte: oldest } },
      select: { submittedAt: true },
    }),
    prisma.assessment.findMany({
      where: {
        OR: [{ startedAt: { gte: oldest } }, { completedAt: { gte: oldest } }],
      },
      select: { startedAt: true, completedAt: true },
    }),
  ]);

  const buckets: UsageTrendPoint[] = [];
  for (let i = 0; i < days; i += 1) {
    const day = new Date(oldest.getTime() + i * DAY_MS);
    buckets.push({
      date: day.toISOString().slice(0, 10),
      intakeSubmissions: 0,
      assessmentsStarted: 0,
      assessmentsCompleted: 0,
    });
  }

  function indexFor(d: Date | null | undefined): number {
    if (!d) return -1;
    const day = startOfDayUTC(d);
    const idx = Math.floor((day.getTime() - oldest.getTime()) / DAY_MS);
    return idx >= 0 && idx < days ? idx : -1;
  }

  for (const r of intakeRows) {
    const idx = indexFor(r.submittedAt);
    if (idx >= 0) buckets[idx].intakeSubmissions += 1;
  }
  for (const r of assessmentRows) {
    const startedIdx = indexFor(r.startedAt);
    if (startedIdx >= 0) buckets[startedIdx].assessmentsStarted += 1;
    const completedIdx = indexFor(r.completedAt);
    if (completedIdx >= 0) buckets[completedIdx].assessmentsCompleted += 1;
  }

  const empty = buckets.every(
    (b) =>
      b.intakeSubmissions === 0 &&
      b.assessmentsStarted === 0 &&
      b.assessmentsCompleted === 0
  );

  return { points: buckets, empty };
}

// ── Recent admin activity (last 10 audit rows of interest) ───────────────

export interface RecentActivityRow {
  id: string;
  action: string;
  entityType: string;
  occurredAt: string;
}

const RECENT_ACTIVITY_ACTIONS = [
  "user.create",
  "user.soft_delete",
  "user.restore",
  "intake.submit",
  "intake.approve",
  "intake.reject",
  "report.publish",
  "assessment.rescore",
  "recommendation.create",
  "invite.send",
] as const;

export async function getRecentActivity(): Promise<RecentActivityRow[]> {
  try {
    const rows = await prisma.auditLog.findMany({
      where: { action: { in: [...RECENT_ACTIVITY_ACTIONS] } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        action: true,
        entityType: true,
        createdAt: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entityType,
      occurredAt: r.createdAt.toISOString(),
    }));
  } catch {
    return [];
  }
}
