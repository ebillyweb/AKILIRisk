import { prisma } from "@/lib/db";
import { decryptUserEmail } from "@/lib/auth/user-email";
import { paletteForRiskLevel } from "@/lib/assessment/risk-color-palette";
import { getPlatformPillarCatalog } from "@/lib/methodology/cached-pillar-catalog";
import { sortPillarCatalog } from "@/lib/methodology/pillar-catalog";
import type { RiskLevelPalette } from "@/lib/assessment/risk-color-palette";
import {
  PRODUCTION_ADVISOR_SUBSCRIPTION_WHERE,
  PRODUCTION_ASSESSMENT_RECOMMENDATION_WHERE,
  PRODUCTION_CLIENT_ASSESSMENT_WHERE,
  PRODUCTION_CLIENT_ASSIGNMENT_WHERE,
  PRODUCTION_CLIENT_REPORT_WHERE,
  productionUserWhere,
} from "@/lib/admin/metrics-user-filters";

/**
 * §9.1 (BRD): AKILI-side aggregate analytics queries. Server-only;
 * read every advisor's data; admin-gated at the page layer (see
 * `/admin/analytics/page.tsx`).
 *
 * Each helper returns a small, structured object that contains
 * **aggregate counts and averages only** — no individual client
 * identifiers (no clientId, clientName, clientEmail, familyName, etc.).
 * The PII-invariant test in `analytics-queries.test.ts` enforces this
 * structurally so future drift is caught.
 *
 * Tenant data (advisor firmName, email) IS exposed in the
 * top-tenants helper because it's commercial counterparty data, not
 * client PII (per round-11 §5.1 amendment). Test allowlists the
 * advisor.* fields explicitly.
 */

// ── 1. Top-level KPIs ──────────────────────────────────────────────────────

export interface PlatformKpis {
  advisorsActive: number;
  advisorsSoftDeleted: number;
  enterprisesActive: number;
  enterprisesProvisioning: number;
  enterprisesSuspended: number;
  clientsActive: number;
  clientsSoftDeleted: number;
  scoredAssessments: number;
  publishedReports: number;
  draftReports: number;
  activeSubscriptions: number;
}

export async function getPlatformKpis(): Promise<PlatformKpis> {
  const [
    advisorsActive,
    advisorsSoftDeleted,
    enterprisesActive,
    enterprisesProvisioning,
    enterprisesSuspended,
    clientsActive,
    clientsSoftDeleted,
    scoredAssessmentRows,
    publishedReports,
    draftReports,
    activeSubscriptions,
  ] = await Promise.all([
    prisma.user.count({ where: productionUserWhere({ role: "ADVISOR", deletedAt: null }) }),
    prisma.user.count({ where: productionUserWhere({ role: "ADVISOR", deletedAt: { not: null } }) }),
    prisma.advisorEnterprise.count({ where: { status: "ACTIVE" } }),
    prisma.advisorEnterprise.count({ where: { status: "PROVISIONING" } }),
    prisma.advisorEnterprise.count({ where: { status: "SUSPENDED" } }),
    prisma.user.count({ where: productionUserWhere({ role: "USER", deletedAt: null }) }),
    prisma.user.count({ where: productionUserWhere({ role: "USER", deletedAt: { not: null } }) }),
    // "Scored assessments" = distinct Assessment rows with at least one
    // PillarScore. groupBy(assessmentId) is the cheapest cross-DB way
    // to count distinct assessment ids that have ≥ 1 score.
    prisma.pillarScore.groupBy({
      by: ["assessmentId"],
      where: { assessment: PRODUCTION_CLIENT_ASSESSMENT_WHERE },
      _count: { _all: true },
    }),
    prisma.report.count({
      where: { status: "PUBLISHED", ...PRODUCTION_CLIENT_REPORT_WHERE },
    }),
    prisma.report.count({
      where: { status: "DRAFT", ...PRODUCTION_CLIENT_REPORT_WHERE },
    }),
    // Active subscriptions: ACTIVE OR GRACE_PERIOD (clients with grace
    // are still serviceable; PAST_DUE/CANCELLED/UNPAID are not).
    prisma.subscription.count({
      where: {
        status: { in: ["ACTIVE", "GRACE_PERIOD"] },
        ...PRODUCTION_ADVISOR_SUBSCRIPTION_WHERE,
      },
    }),
  ]);

  return {
    advisorsActive,
    advisorsSoftDeleted,
    enterprisesActive,
    enterprisesProvisioning,
    enterprisesSuspended,
    clientsActive,
    clientsSoftDeleted,
    scoredAssessments: scoredAssessmentRows.length,
    publishedReports,
    draftReports,
    activeSubscriptions,
  };
}

// ── Internal: latest-per-pillar-per-client PillarScore selection ───────────

/**
 * Resolve the latest PillarScore per (assessment, pillar) — the
 * "exact" scope per the §9.1 design proposal sign-off. Mirrors the
 * pattern from `getPortfolioPillarScores` in
 * `src/lib/intelligence/queries.ts` but at platform scope.
 *
 * The "latest per (assessment, pillar)" set excludes prior rescore
 * history without inflating counts. Each (assessment, pillar) pair
 * gets exactly one row.
 *
 * Then, to "latest per (client, pillar)" — there can be multiple
 * Assessments per client — we further filter to the most recent
 * Assessment per client by `completedAt`. The composite ensures every
 * cross-tenant aggregate is a "current state" snapshot.
 */
export type LatestPillarScoreByClientRow = {
  userId: string;
  pillar: string;
  score: number;
  riskLevel: string;
};

/**
 * Latest pillar score per domain for each client's most recent COMPLETED
 * assessment. Includes `userId` for server-side aggregation only — admin
 * pages must not surface per-client identifiers (see risk-signals-queries).
 */
export async function loadLatestPillarScoresByClient(): Promise<
  LatestPillarScoreByClientRow[]
> {
  // 1. Most recent COMPLETED assessment per client.
  const latestPerClient = await prisma.assessment.groupBy({
    by: ["userId"],
    where: {
      status: "COMPLETED",
      completedAt: { not: null },
      ...PRODUCTION_CLIENT_ASSESSMENT_WHERE,
    },
    _max: { completedAt: true },
  });
  const pairs = latestPerClient
    .filter((g) => g._max.completedAt !== null)
    .map((g) => ({ userId: g.userId, completedAt: g._max.completedAt! }));
  if (pairs.length === 0) return [];

  // Resolve the (userId, completedAt) tuples back to assessment ids.
  const latestAssessments = await prisma.assessment.findMany({
    where: {
      OR: pairs.map((p) => ({
        userId: p.userId,
        completedAt: p.completedAt,
        status: "COMPLETED" as const,
      })),
    },
    select: { id: true, userId: true },
  });
  const assessmentIds = latestAssessments.map((a) => a.id);
  if (assessmentIds.length === 0) return [];

  const userIdByAssessmentId = new Map(
    latestAssessments.map((a) => [a.id, a.userId] as const)
  );

  // 2. For each of those assessments, take the latest PillarScore per
  //    pillar. groupBy(assessmentId, pillar) max(calculatedAt) gives
  //    the timestamps; resolve back to score+riskLevel via findMany.
  const latestPerPillar = await prisma.pillarScore.groupBy({
    by: ["assessmentId", "pillar"],
    where: { assessmentId: { in: assessmentIds } },
    _max: { calculatedAt: true },
  });
  if (latestPerPillar.length === 0) return [];

  const scoreRows = await prisma.pillarScore.findMany({
    where: {
      OR: latestPerPillar
        .filter((g) => g._max.calculatedAt !== null)
        .map((g) => ({
          assessmentId: g.assessmentId,
          pillar: g.pillar,
          calculatedAt: g._max.calculatedAt!,
        })),
    },
    select: {
      assessmentId: true,
      pillar: true,
      score: true,
      riskLevel: true,
    },
  });

  const rows: LatestPillarScoreByClientRow[] = [];
  for (const row of scoreRows) {
    const userId = userIdByAssessmentId.get(row.assessmentId);
    if (!userId) continue;
    rows.push({
      userId,
      pillar: row.pillar,
      score: row.score,
      riskLevel: row.riskLevel,
    });
  }
  return rows;
}

async function loadLatestPillarScoresPlatformWide(): Promise<
  Array<{ pillar: string; score: number; riskLevel: string }>
> {
  const rows = await loadLatestPillarScoresByClient();
  return rows.map(({ pillar, score, riskLevel }) => ({
    pillar,
    score,
    riskLevel,
  }));
}

// ── 2. Risk-level distribution ─────────────────────────────────────────────

export interface RiskDistribution {
  totalScored: number;
  buckets: Array<{
    level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    count: number;
    percent: number;
    palette: RiskLevelPalette;
  }>;
}

export async function getRiskLevelDistribution(): Promise<RiskDistribution> {
  const rows = await loadLatestPillarScoresPlatformWide();
  const total = rows.length;
  const counts: Record<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL", number> = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0,
  };
  for (const r of rows) {
    if (
      r.riskLevel === "LOW" ||
      r.riskLevel === "MEDIUM" ||
      r.riskLevel === "HIGH" ||
      r.riskLevel === "CRITICAL"
    ) {
      counts[r.riskLevel] += 1;
    }
  }
  const order: Array<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL"> = [
    "LOW",
    "MEDIUM",
    "HIGH",
    "CRITICAL",
  ];
  return {
    totalScored: total,
    buckets: order.map((level) => ({
      level,
      count: counts[level],
      percent: total === 0 ? 0 : (counts[level] / total) * 100,
      palette: paletteForRiskLevel(level),
    })),
  };
}

// ── 3. Per-pillar averages ─────────────────────────────────────────────────

export interface PillarAverage {
  pillarId: string;
  pillarName: string;
  count: number;
  avgScore: number | null;
  dominantLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "unassessed";
  palette: RiskLevelPalette;
}

export interface PillarAveragesResult {
  pillars: PillarAverage[];
  totalScored: number;
}

export async function getPillarAverages(): Promise<PillarAveragesResult> {
  const [rows, catalog] = await Promise.all([
    loadLatestPillarScoresPlatformWide(),
    getPlatformPillarCatalog(),
  ]);

  type LvlKey = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  type Bucket = {
    sum: number;
    count: number;
    levels: Record<LvlKey, number>;
  };
  const byPillar = new Map<string, Bucket>();

  for (const r of rows) {
    let bucket = byPillar.get(r.pillar);
    if (!bucket) {
      bucket = {
        sum: 0,
        count: 0,
        levels: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
      };
      byPillar.set(r.pillar, bucket);
    }
    bucket.sum += r.score;
    bucket.count += 1;
    if (
      r.riskLevel === "LOW" ||
      r.riskLevel === "MEDIUM" ||
      r.riskLevel === "HIGH" ||
      r.riskLevel === "CRITICAL"
    ) {
      bucket.levels[r.riskLevel] += 1;
    }
  }

  const pillars: PillarAverage[] = sortPillarCatalog(catalog).map((area) => {
    const bucket = byPillar.get(area.id);
    if (!bucket || bucket.count === 0) {
      return {
        pillarId: area.id,
        pillarName: area.name,
        count: 0,
        avgScore: null,
        dominantLevel: "unassessed" as const,
        palette: paletteForRiskLevel(null),
      };
    }
    // Dominant = mode of the riskLevel buckets, ties broken by severity
    // (CRITICAL > HIGH > MEDIUM > LOW) so the most-at-risk dominant
    // shows when two levels are tied.
    const order: LvlKey[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
    let dominant: LvlKey = "LOW";
    let dominantCount = -1;
    for (const lvl of order) {
      const c = bucket.levels[lvl];
      if (c > dominantCount) {
        dominant = lvl;
        dominantCount = c;
      }
    }
    return {
      pillarId: area.id,
      pillarName: area.name,
      count: bucket.count,
      avgScore: bucket.sum / bucket.count,
      dominantLevel: dominant,
      palette: paletteForRiskLevel(dominant),
    };
  });

  return { pillars, totalScored: rows.length };
}

// ── 4. Top tenants by client count ─────────────────────────────────────────

export interface TopTenantRow {
  advisorProfileId: string;
  advisorUserId: string;
  firmName: string | null;
  email: string;
  activeClientCount: number;
  scoredAssessmentCount: number;
}

const TOP_TENANTS_LIMIT = 10;

export async function getTopTenantsByClientCount(): Promise<TopTenantRow[]> {
  // 1. groupBy advisorId on ACTIVE assignments → top N by row count.
  const grouped = await prisma.clientAdvisorAssignment.groupBy({
    by: ["advisorId"],
    where: { status: "ACTIVE", ...PRODUCTION_CLIENT_ASSIGNMENT_WHERE },
    _count: { _all: true },
    orderBy: { _count: { advisorId: "desc" } },
    take: TOP_TENANTS_LIMIT,
  });
  if (grouped.length === 0) return [];

  const advisorIds = grouped.map((g) => g.advisorId);

  // 2. Resolve advisor profile + user.
  const advisors = await prisma.advisorProfile.findMany({
    where: { id: { in: advisorIds } },
    select: {
      id: true,
      firmName: true,
      userId: true,
      user: { select: { emailCiphertext: true } },
    },
  });
  const advisorById = new Map(advisors.map((a) => [a.id, a]));

  // 3. Per-advisor scored-assessment count: distinct assessmentIds that
  //    have ≥ 1 PillarScore AND whose owner is an active assignment of
  //    this advisor. One query per advisor would be N+1 — instead, do
  //    a single batched query.
  const assignmentRows = await prisma.clientAdvisorAssignment.findMany({
    where: {
      advisorId: { in: advisorIds },
      status: "ACTIVE",
      ...PRODUCTION_CLIENT_ASSIGNMENT_WHERE,
    },
    select: { advisorId: true, clientId: true },
  });
  const advisorByClient = new Map<string, string>();
  for (const a of assignmentRows) advisorByClient.set(a.clientId, a.advisorId);

  const clientIds = Array.from(advisorByClient.keys());
  const scoredByAdvisor = new Map<string, number>();
  if (clientIds.length > 0) {
    const scoredAssessments = await prisma.assessment.findMany({
      where: {
        userId: { in: clientIds },
        scores: { some: {} },
        ...PRODUCTION_CLIENT_ASSESSMENT_WHERE,
      },
      select: { userId: true, id: true },
    });
    for (const a of scoredAssessments) {
      const advisorId = advisorByClient.get(a.userId);
      if (!advisorId) continue;
      scoredByAdvisor.set(advisorId, (scoredByAdvisor.get(advisorId) ?? 0) + 1);
    }
  }

  return grouped.map((g) => {
    const advisor = advisorById.get(g.advisorId);
    return {
      advisorProfileId: g.advisorId,
      advisorUserId: advisor?.userId ?? "",
      firmName: advisor?.firmName ?? null,
      email: advisor?.user.emailCiphertext
        ? decryptUserEmail(advisor.user.emailCiphertext)
        : "",
      activeClientCount: g._count._all,
      scoredAssessmentCount: scoredByAdvisor.get(g.advisorId) ?? 0,
    };
  });
}

// ── 5. Common missing controls ─────────────────────────────────────────────

export interface MissingControlRow {
  serviceRecommendationId: string;
  name: string;
  category: string;
  count: number;
}

const MISSING_CONTROLS_LIMIT = 10;

export async function getCommonMissingControls(): Promise<MissingControlRow[]> {
  const grouped = await prisma.assessmentRecommendation.groupBy({
    by: ["serviceRecommendationId"],
    where: PRODUCTION_ASSESSMENT_RECOMMENDATION_WHERE,
    _count: { _all: true },
    orderBy: { _count: { serviceRecommendationId: "desc" } },
    take: MISSING_CONTROLS_LIMIT,
  });
  if (grouped.length === 0) return [];

  const serviceIds = grouped.map((g) => g.serviceRecommendationId);
  const services = await prisma.serviceRecommendation.findMany({
    where: { id: { in: serviceIds } },
    select: { id: true, name: true, category: true },
  });
  const serviceById = new Map(services.map((s) => [s.id, s]));

  return grouped.map((g) => {
    const svc = serviceById.get(g.serviceRecommendationId);
    return {
      serviceRecommendationId: g.serviceRecommendationId,
      name: svc?.name ?? "(deleted recommendation)",
      category: svc?.category ?? "—",
      count: g._count._all,
    };
  });
}
