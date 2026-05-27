import "server-only";

import { prisma } from "@/lib/db";
import { decryptUserEmail } from "@/lib/auth/user-email";
import { RISK_AREAS } from "@/lib/advisor/types";
import { loadLatestPillarScoresByClient } from "@/lib/admin/analytics-queries";
import { getSeverity } from "@/lib/intelligence/queries";
import type { RiskSeverity } from "@/lib/intelligence/types";

/**
 * Platform-wide risk signals — aggregate intelligence-style metrics across
 * every advisor's clients. Super-admin page at `/admin/risk-signals`.
 *
 * Same PII rules as §9.1 analytics: no clientId, clientName, familyName,
 * or generic userId in return types. Advisor firm/email is allowed on
 * tenant rows (commercial counterparty data).
 */

export interface PlatformRiskSignalsSummary {
  familiesWithAssessment: number;
  familiesAtRisk: number;
  criticalIndicators: number;
  moderateIndicators: number;
  totalIndicators: number;
}

export interface PillarRiskSignal {
  pillarId: string;
  pillarName: string;
  familiesAtRisk: number;
  avgScore: number | null;
  criticalCount: number;
  moderateCount: number;
}

export interface TenantRiskExposureRow {
  advisorProfileId: string;
  advisorUserId: string;
  firmName: string | null;
  email: string;
  familiesWithAssessment: number;
  familiesAtRisk: number;
  criticalIndicators: number;
}

export interface PlatformRiskSignals {
  summary: PlatformRiskSignalsSummary;
  bySeverity: Record<RiskSeverity, number>;
  pillars: PillarRiskSignal[];
  /** Families with critical/moderate in each pillar (matches advisor INTEL-03 shape). */
  risksByCategory: Record<string, number>;
  topTenantsByRisk: TenantRiskExposureRow[];
}

const TOP_TENANTS_BY_RISK_LIMIT = 10;

type PillarBucket = {
  sum: number;
  count: number;
  familiesAtRisk: number;
  criticalCount: number;
  moderateCount: number;
};

function aggregateClientPillarRows(
  rows: Awaited<ReturnType<typeof loadLatestPillarScoresByClient>>
): {
  byClient: Map<string, Array<{ pillar: string; score: number; severity: RiskSeverity }>>;
  summary: PlatformRiskSignalsSummary;
  bySeverity: Record<RiskSeverity, number>;
  risksByCategory: Record<string, number>;
  pillarBuckets: Map<string, PillarBucket>;
} {
  const byClient = new Map<
    string,
    Array<{ pillar: string; score: number; severity: RiskSeverity }>
  >();

  for (const row of rows) {
    const severity = getSeverity(row.score);
    const list = byClient.get(row.userId) ?? [];
    list.push({ pillar: row.pillar, score: row.score, severity });
    byClient.set(row.userId, list);
  }

  let familiesAtRisk = 0;
  let criticalIndicators = 0;
  let moderateIndicators = 0;
  const bySeverity: Record<RiskSeverity, number> = {
    critical: 0,
    moderate: 0,
    low: 0,
  };
  const risksByCategory: Record<string, number> = {};
  const pillarBuckets = new Map<string, PillarBucket>();

  for (const [, pillarRows] of byClient) {
    const familyAtRisk = pillarRows.some(
      (p) => p.severity === "critical" || p.severity === "moderate"
    );
    if (familyAtRisk) familiesAtRisk++;

    for (const { pillar, score, severity } of pillarRows) {
      bySeverity[severity] += 1;
      if (severity === "critical") criticalIndicators++;
      if (severity === "moderate") moderateIndicators++;

      let bucket = pillarBuckets.get(pillar);
      if (!bucket) {
        bucket = {
          sum: 0,
          count: 0,
          familiesAtRisk: 0,
          criticalCount: 0,
          moderateCount: 0,
        };
        pillarBuckets.set(pillar, bucket);
      }
      bucket.sum += score;
      bucket.count += 1;
      if (severity === "critical") bucket.criticalCount++;
      if (severity === "moderate") bucket.moderateCount++;
      if (severity === "critical" || severity === "moderate") {
        bucket.familiesAtRisk += 1;
        risksByCategory[pillar] = (risksByCategory[pillar] ?? 0) + 1;
      }
    }
  }

  return {
    byClient,
    summary: {
      familiesWithAssessment: byClient.size,
      familiesAtRisk,
      criticalIndicators,
      moderateIndicators,
      totalIndicators: rows.length,
    },
    bySeverity,
    risksByCategory,
    pillarBuckets,
  };
}

function buildPillarSignals(
  pillarBuckets: Map<string, PillarBucket>
): PillarRiskSignal[] {
  const signals = RISK_AREAS.map((area) => {
    const bucket = pillarBuckets.get(area.id);
    if (!bucket || bucket.count === 0) {
      return {
        pillarId: area.id,
        pillarName: area.name,
        familiesAtRisk: 0,
        avgScore: null,
        criticalCount: 0,
        moderateCount: 0,
      };
    }
    return {
      pillarId: area.id,
      pillarName: area.name,
      familiesAtRisk: bucket.familiesAtRisk,
      avgScore: bucket.sum / bucket.count,
      criticalCount: bucket.criticalCount,
      moderateCount: bucket.moderateCount,
    };
  });

  return signals.sort((a, b) => {
    if (b.familiesAtRisk !== a.familiesAtRisk) {
      return b.familiesAtRisk - a.familiesAtRisk;
    }
    const avgA = a.avgScore ?? Infinity;
    const avgB = b.avgScore ?? Infinity;
    return avgA - avgB;
  });
}

async function getTopTenantsByRiskExposure(
  byClient: Map<string, Array<{ severity: RiskSeverity }>>
): Promise<TenantRiskExposureRow[]> {
  const assignments = await prisma.clientAdvisorAssignment.findMany({
    where: { status: "ACTIVE" },
    select: { advisorId: true, clientId: true },
  });
  if (assignments.length === 0) return [];

  const clientsByAdvisor = new Map<string, string[]>();
  for (const { advisorId, clientId } of assignments) {
    const list = clientsByAdvisor.get(advisorId) ?? [];
    list.push(clientId);
    clientsByAdvisor.set(advisorId, list);
  }

  const tenantStats: Array<{
    advisorProfileId: string;
    familiesWithAssessment: number;
    familiesAtRisk: number;
    criticalIndicators: number;
  }> = [];

  for (const [advisorProfileId, clientIds] of clientsByAdvisor) {
    let familiesWithAssessment = 0;
    let familiesAtRisk = 0;
    let criticalIndicators = 0;

    for (const clientId of clientIds) {
      const pillars = byClient.get(clientId);
      if (!pillars || pillars.length === 0) continue;
      familiesWithAssessment++;
      const atRisk = pillars.some(
        (p) => p.severity === "critical" || p.severity === "moderate"
      );
      if (atRisk) familiesAtRisk++;
      criticalIndicators += pillars.filter((p) => p.severity === "critical").length;
    }

    if (familiesWithAssessment === 0) continue;

    tenantStats.push({
      advisorProfileId,
      familiesWithAssessment,
      familiesAtRisk,
      criticalIndicators,
    });
  }

  tenantStats.sort((a, b) => {
    if (b.familiesAtRisk !== a.familiesAtRisk) {
      return b.familiesAtRisk - a.familiesAtRisk;
    }
    if (b.criticalIndicators !== a.criticalIndicators) {
      return b.criticalIndicators - a.criticalIndicators;
    }
    return b.familiesWithAssessment - a.familiesWithAssessment;
  });

  const top = tenantStats.slice(0, TOP_TENANTS_BY_RISK_LIMIT);
  if (top.length === 0) return [];

  const advisors = await prisma.advisorProfile.findMany({
    where: { id: { in: top.map((t) => t.advisorProfileId) } },
    select: {
      id: true,
      firmName: true,
      userId: true,
      user: { select: { emailCiphertext: true } },
    },
  });
  const advisorById = new Map(advisors.map((a) => [a.id, a] as const));

  return top.map((t) => {
    const advisor = advisorById.get(t.advisorProfileId);
    return {
      advisorProfileId: t.advisorProfileId,
      advisorUserId: advisor?.userId ?? "",
      firmName: advisor?.firmName ?? null,
      email: advisor
        ? decryptUserEmail(advisor.user.emailCiphertext)
        : "(unknown advisor)",
      familiesWithAssessment: t.familiesWithAssessment,
      familiesAtRisk: t.familiesAtRisk,
      criticalIndicators: t.criticalIndicators,
    };
  });
}

export async function getPlatformRiskSignals(): Promise<PlatformRiskSignals> {
  const rows = await loadLatestPillarScoresByClient();
  const { byClient, summary, bySeverity, risksByCategory, pillarBuckets } =
    aggregateClientPillarRows(rows);

  const [pillars, topTenantsByRisk] = await Promise.all([
    Promise.resolve(buildPillarSignals(pillarBuckets)),
    getTopTenantsByRiskExposure(byClient),
  ]);

  return {
    summary,
    bySeverity,
    pillars,
    risksByCategory,
    topTenantsByRisk,
  };
}
