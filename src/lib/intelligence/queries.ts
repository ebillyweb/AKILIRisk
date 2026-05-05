import "server-only";

import { prisma } from "@/lib/db";
import { PILLAR_WEIGHTS } from "@/lib/analytics/queries";
import { CATEGORY_LABELS } from "@/lib/analytics/formatters";
import type { RiskSeverity, RiskIndicator, FamilyRiskSummary, PortfolioIntelligence, RiskDetail, RiskRecommendation, AssessmentResponseDetail, PortfolioPillarRow } from "./types";

/**
 * Static governance recommendations mapped by category slug
 */
const RISK_RECOMMENDATIONS: Record<string, RiskRecommendation[]> = {
  governance: [
    {
      title: 'Clarify decision rights and conflict paths',
      description: 'Document who decides what, voting thresholds, and how disputes escalate for family and advisors',
      priority: 'high',
    },
    {
      title: 'Institute formal governance meetings',
      description: 'Use scheduled meetings with agendas, minutes, and a secure document repository for policies and records',
      priority: 'high',
    },
    {
      title: 'Coordinate advisors on one facts set',
      description: 'Reduce silos so legal, tax, security, and investment advice stay consistent',
      priority: 'medium',
    },
  ],
  'environmental-geographic-risk': [
    { title: 'Map hazard exposure for each primary property', description: 'Document flood, wind, wildfire, seismic, and heat risk with insurance broker and civil sources', priority: 'high' },
    { title: 'Reconcile property coverage with replacement value', description: 'Align dwelling, flood, wind, and umbrella limits with current construction and ordinance costs', priority: 'high' },
    { title: 'Rehearse evacuation and continuity', description: 'Write down routes, rally points, communications tree, and records to grab under time pressure', priority: 'medium' },
  ],
  'physical-security': [
    { title: 'Layer residence controls', description: 'Upgrade lighting, entry hardware, alarms, and monitoring with periodic professional review', priority: 'high' },
    { title: 'Institute travel security norms', description: 'Use pre-trip briefings, vetted transport, and check-ins for higher-risk destinations', priority: 'medium' },
    { title: 'Brief dependents away from home', description: 'Give students and travelers clear emergency contacts and duress expectations', priority: 'medium' },
  ],
  'cybersecurity': [
    { title: 'Tighten identity and account recovery', description: 'Enable MFA, hardware keys where appropriate, and locked-down recovery options on financial and email accounts', priority: 'high' },
    { title: 'Segment home and device access', description: 'Use guest Wi-Fi, patch routers, and inventory IoT; monitor family members most targeted for fraud', priority: 'high' },
    { title: 'Schedule periodic access reviews', description: 'Audit who can see sensitive financial and estate information', priority: 'medium' },
  ],
  'financial-asset-protection': [
    { title: 'Close insurance and liability gaps', description: 'Review property, excess, D&O, cyber, and professional coverage against real exposures', priority: 'high' },
    { title: 'Stress-test concentration', description: 'Model liquidity and loss scenarios for large real estate, operating business, or single-manager positions', priority: 'high' },
    { title: 'Refresh trusts, titling, and succession documents', description: 'Keep estate plans, marital agreements, and business buy-sell provisions current', priority: 'medium' },
    { title: 'Centralize medical directives and history', description: 'Maintain portable medication lists, allergies, and emergency contacts', priority: 'high' },
    { title: 'Align travel with medical evacuation coverage', description: 'Confirm international coverage, telehealth, and transport for serious events', priority: 'medium' },
    { title: 'Plan for regional health disruptions', description: 'Assign caregiving contingencies for elders and dependents when schools or services close', priority: 'medium' },
  ],
  'lifestyle-behavioral-risk': [
    { title: 'Govern public and digital visibility', description: 'Set expectations for social media, press, and sharing wealth-related information', priority: 'high' },
    { title: 'Codify conduct and family standards', description: 'Document behavioral expectations, enforcement, and support for sensitive issues such as substance use', priority: 'high' },
    { title: 'Reduce undue exposure from routines', description: 'Review predictable patterns that increase targeting or reputational risk', priority: 'medium' },
  ],
};

/** Map legacy governance subcategory slugs to six-pillar keys for recommendations */
const LEGACY_RISK_CATEGORY_MAP: Record<string, keyof typeof RISK_RECOMMENDATIONS> = {
  'decision-making-authority': 'governance',
  'access-controls': 'cybersecurity',
  'trust-estate-governance': 'financial-asset-protection',
  'marriage-relationship-risk': 'financial-asset-protection',
  'succession-planning': 'financial-asset-protection',
  'behavior-standards': 'lifestyle-behavioral-risk',
  'business-involvement': 'financial-asset-protection',
  'documentation-communication': 'governance',
};

function resolveRiskRecommendationKey(categorySlug: string): string {
  if (categorySlug === 'health-medical-preparedness') return 'financial-asset-protection';
  if (categorySlug in RISK_RECOMMENDATIONS) return categorySlug;
  return LEGACY_RISK_CATEGORY_MAP[categorySlug] ?? categorySlug;
}

/**
 * Get recommendations for a specific category slug with severity-based priority adjustment
 */
function getRecommendationsForCategory(categorySlug: string, severity: RiskSeverity): RiskRecommendation[] {
  const key = resolveRiskRecommendationKey(categorySlug);
  const baseRecommendations = RISK_RECOMMENDATIONS[key] || [];

  // Adjust priority based on severity
  return baseRecommendations.map(rec => ({
    ...rec,
    priority: severity === 'critical' ? 'high' : severity === 'moderate' ? 'medium' : 'low'
  }));
}

/**
 * Determine risk severity based on governance score
 */
export function getSeverity(score: number): RiskSeverity {
  if (score <= 3.0) return 'critical';
  if (score <= 5.0) return 'moderate';
  return 'low';
}

/**
 * Calculate weighted overall score from pillar scores
 */
function calculateWeightedScore(pillarScores: { pillar: string; score: number }[]): number {
  let totalScore = 0;
  let totalWeight = 0;

  for (const pillarScore of pillarScores) {
    const weight = PILLAR_WEIGHTS[pillarScore.pillar as keyof typeof PILLAR_WEIGHTS];
    if (weight) {
      totalScore += pillarScore.score * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0 ? totalScore / totalWeight : 0;
}

/**
 * Get top 3 governance risks for a specific family (INTEL-01)
 */
export async function getTopRisksForFamily(
  clientId: string,
  advisorProfileId: string
): Promise<FamilyRiskSummary | null> {
  // Step a: Verify advisor-client relationship
  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: {
      advisorId: advisorProfileId,
      clientId: clientId,
      status: 'ACTIVE',
    },
    include: {
      client: {
        select: {
          id: true,
          email: true,
        }
      }
    }
  });

  if (!assignment) {
    return null;
  }

  // Step b: Get latest completed assessment with scores
  const assessment = await prisma.assessment.findFirst({
    where: {
      userId: clientId,
      status: 'COMPLETED',
    },
    include: {
      scores: true,
    },
    orderBy: {
      completedAt: 'desc',
    },
  });

  if (!assessment || !assessment.completedAt) {
    return null;
  }

  // Get total assessment count
  const assessmentCount = await prisma.assessment.count({
    where: {
      userId: clientId,
      status: 'COMPLETED',
    },
  });

  // Step c: Create RiskIndicators for each pillar score
  const riskIndicators: RiskIndicator[] = assessment.scores.map(pillarScore => ({
    familyId: clientId,
    familyName: assignment.client.email,
    categorySlug: pillarScore.pillar,
    categoryName: CATEGORY_LABELS[pillarScore.pillar] || pillarScore.pillar,
    score: pillarScore.score,
    severity: getSeverity(pillarScore.score),
    weight: PILLAR_WEIGHTS[pillarScore.pillar as keyof typeof PILLAR_WEIGHTS] || 0,
    assessmentId: assessment.id,
    assessmentDate: assessment.completedAt!.toISOString(),
  }));

  // Step d & e: Sort by score ascending (lowest first = highest risk) and take top 3
  const topRisks = riskIndicators
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  // Step f: Calculate weighted overall score
  const overallScore = calculateWeightedScore(assessment.scores);

  // Step g: Return FamilyRiskSummary
  return {
    familyId: clientId,
    familyName: assignment.client.email,
    overallScore,
    topRisks,
    assessmentCount,
    latestAssessmentDate: assessment.completedAt!.toISOString(),
  };
}

/**
 * Get portfolio-wide governance intelligence (INTEL-02, INTEL-03)
 */
export async function getPortfolioIntelligence(
  advisorProfileId: string
): Promise<PortfolioIntelligence> {
  // Get all active client assignments for this advisor
  const assignments = await prisma.clientAdvisorAssignment.findMany({
    where: {
      advisorId: advisorProfileId,
      status: 'ACTIVE',
    },
    include: {
      client: {
        select: {
          id: true,
          email: true,
        }
      }
    }
  });

  const familyRiskSummaries: FamilyRiskSummary[] = [];
  const allPortfolioRisks: RiskIndicator[] = [];
  const risksByCategory: Record<string, number> = {};
  let familiesAtRisk = 0;
  let criticalCount = 0;

  // Process each client
  for (const assignment of assignments) {
    // Get latest completed assessment for this client
    const assessment = await prisma.assessment.findFirst({
      where: {
        userId: assignment.clientId,
        status: 'COMPLETED',
      },
      include: {
        scores: true,
      },
      orderBy: {
        completedAt: 'desc',
      },
    });

    if (!assessment || !assessment.completedAt) {
      continue;
    }

    // Get assessment count for this client
    const assessmentCount = await prisma.assessment.count({
      where: {
        userId: assignment.clientId,
        status: 'COMPLETED',
      },
    });

    // Create risk indicators for this family (same logic as getTopRisksForFamily)
    const familyRiskIndicators: RiskIndicator[] = assessment.scores.map(pillarScore => ({
      familyId: assignment.clientId,
      familyName: assignment.client.email,
      categorySlug: pillarScore.pillar,
      categoryName: CATEGORY_LABELS[pillarScore.pillar] || pillarScore.pillar,
      score: pillarScore.score,
      severity: getSeverity(pillarScore.score),
      weight: PILLAR_WEIGHTS[pillarScore.pillar as keyof typeof PILLAR_WEIGHTS] || 0,
      assessmentId: assessment.id,
      assessmentDate: assessment.completedAt!.toISOString(),
    }));

    // Get top 3 risks for this family
    const topRisks = familyRiskIndicators
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);

    // Calculate overall score
    const overallScore = calculateWeightedScore(assessment.scores);

    // Create family risk summary
    const familyRiskSummary: FamilyRiskSummary = {
      familyId: assignment.clientId,
      familyName: assignment.client.email,
      overallScore,
      topRisks,
      assessmentCount,
      latestAssessmentDate: assessment.completedAt!.toISOString(),
    };

    familyRiskSummaries.push(familyRiskSummary);

    // Add all risks to portfolio risks
    allPortfolioRisks.push(...familyRiskIndicators);

    // Check if family is at risk (has critical or moderate risks)
    const hasRisk = familyRiskIndicators.some(risk =>
      risk.severity === 'critical' || risk.severity === 'moderate'
    );
    if (hasRisk) {
      familiesAtRisk++;
    }

    // Count critical risks
    const familyCriticalCount = familyRiskIndicators.filter(risk =>
      risk.severity === 'critical'
    ).length;
    criticalCount += familyCriticalCount;

    // Update risks by category (count families with critical or moderate risk in each category)
    familyRiskIndicators.forEach(risk => {
      if (risk.severity === 'critical' || risk.severity === 'moderate') {
        risksByCategory[risk.categorySlug] = (risksByCategory[risk.categorySlug] || 0) + 1;
      }
    });
  }

  // Sort portfolio risks by severity order (critical=0, moderate=1, low=2) then by score ascending
  const severityOrder = { critical: 0, moderate: 1, low: 2 };
  const portfolioRisks = allPortfolioRisks.sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return a.score - b.score; // Then by score ascending within same severity
  });

  return {
    totalFamilies: assignments.length,
    familiesAtRisk,
    criticalCount,
    familyRiskSummaries,
    portfolioRisks,
    risksByCategory,
  };
}

/**
 * Get detailed risk information for a specific family with recommendations and assessment responses (INTEL-04)
 */
export async function getRiskDetailForFamily(
  clientId: string,
  advisorProfileId: string
): Promise<RiskDetail | null> {
  // Step a: Verify advisor-client relationship
  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: {
      advisorId: advisorProfileId,
      clientId: clientId,
      status: 'ACTIVE',
    },
    include: {
      client: {
        select: {
          id: true,
          email: true,
        }
      }
    }
  });

  if (!assignment) {
    return null;
  }

  // Step b: Get latest completed assessment with scores
  const assessment = await prisma.assessment.findFirst({
    where: {
      userId: clientId,
      status: 'COMPLETED',
    },
    include: {
      scores: true,
    },
    orderBy: {
      completedAt: 'desc',
    },
  });

  if (!assessment || !assessment.completedAt) {
    return null;
  }

  // Step c: Create RiskIndicators for each pillar score
  const riskIndicators: RiskIndicator[] = assessment.scores.map(pillarScore => ({
    familyId: clientId,
    familyName: assignment.client.email,
    categorySlug: pillarScore.pillar,
    categoryName: CATEGORY_LABELS[pillarScore.pillar] || pillarScore.pillar,
    score: pillarScore.score,
    severity: getSeverity(pillarScore.score),
    weight: PILLAR_WEIGHTS[pillarScore.pillar as keyof typeof PILLAR_WEIGHTS] || 0,
    assessmentId: assessment.id,
    assessmentDate: assessment.completedAt!.toISOString(),
  }));

  // Step d: Sort by score ascending (lowest first = highest risk) and take top 3
  const topRiskIndicators = riskIndicators
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  // Step e: For each top risk, fetch assessment responses and attach recommendations
  const topRisksWithDetails = await Promise.all(
    topRiskIndicators.map(async (risk) => {
      // INTEL-04 critical step: Fetch underlying assessment responses for this pillar
      const assessmentResponses = await prisma.assessmentResponse.findMany({
        where: {
          assessmentId: assessment.id,
          pillar: risk.categorySlug,
        },
        select: {
          questionId: true,
          pillar: true,
          subCategory: true,
          answer: true,
          skipped: true,
          answeredAt: true,
        },
      });

      // Map to AssessmentResponseDetail interface
      const responseDetails: AssessmentResponseDetail[] = assessmentResponses.map(response => ({
        questionId: response.questionId,
        pillar: response.pillar,
        subCategory: response.subCategory || '',
        answer: response.answer,
        skipped: response.skipped,
        answeredAt: response.answeredAt.toISOString(),
      }));

      // Get recommendations for this category
      const recommendations = getRecommendationsForCategory(risk.categorySlug, risk.severity);

      return {
        ...risk,
        recommendations,
        assessmentResponses: responseDetails,
      };
    })
  );

  // Step f: Calculate weighted overall score
  const overallScore = calculateWeightedScore(assessment.scores);

  // Step g: Return complete RiskDetail object
  return {
    familyId: clientId,
    familyName: assignment.client.email,
    overallScore,
    latestAssessmentDate: assessment.completedAt!.toISOString(),
    assessmentId: assessment.id,
    topRisks: topRisksWithDetails,
  };
}

/**
 * Round-10 / B1: per-client × per-pillar grid for the portfolio heat map.
 *
 * Returns one row per advisor-assigned active client. Each row carries
 * whatever pillars have a persisted score on the client's most recent
 * COMPLETED assessment; missing pillars surface as unassessed cells in
 * the heat-map renderer.
 *
 * Performance: bounded to 4 round-trips regardless of client count, same
 * shape as the round-7 P2 pipeline batching:
 *   1. assignments + clients
 *   2. latest COMPLETED assessment per client (via groupBy)
 *   3. PillarScore.findMany IN (latest assessment ids)
 *   4. (no 4th — joined into 3)
 */
export async function getPortfolioPillarScores(
  advisorProfileId: string
): Promise<PortfolioPillarRow[]> {
  // 1. Active assignments with client display info.
  const assignments = await prisma.clientAdvisorAssignment.findMany({
    where: { advisorId: advisorProfileId, status: "ACTIVE" },
    include: {
      client: { select: { id: true, name: true, email: true } },
    },
  });
  if (assignments.length === 0) return [];

  const clientIds = assignments.map((a) => a.clientId);

  // 2. Latest COMPLETED assessment per client. groupBy on userId with a
  //    max(completedAt) gives the timestamp; a follow-up findMany resolves
  //    the actual assessment row by (userId, completedAt) tuples. Two
  //    queries instead of N+1.
  const latestPerClient = await prisma.assessment.groupBy({
    by: ["userId"],
    where: { userId: { in: clientIds }, status: "COMPLETED", completedAt: { not: null } },
    _max: { completedAt: true },
  });
  const latestPairs = latestPerClient
    .filter((g) => g._max.completedAt !== null)
    .map((g) => ({ userId: g.userId, completedAt: g._max.completedAt! }));

  if (latestPairs.length === 0) {
    // Every client has zero scored assessments — return rows with empty
    // pillarScores so the heat map shows them all unassessed.
    return assignments.map((a) => ({
      clientId: a.clientId,
      clientName: a.client.name ?? a.client.email,
      pillarScores: [],
    }));
  }

  const latestAssessments = await prisma.assessment.findMany({
    where: {
      OR: latestPairs.map((p) => ({
        userId: p.userId,
        completedAt: p.completedAt,
        status: "COMPLETED",
      })),
    },
    select: { id: true, userId: true },
  });
  const assessmentIdToUserId = new Map(
    latestAssessments.map((a) => [a.id, a.userId])
  );

  // 3. Single batched PillarScore fetch.
  const allScores = await prisma.pillarScore.findMany({
    where: { assessmentId: { in: latestAssessments.map((a) => a.id) } },
    select: {
      assessmentId: true,
      pillar: true,
      score: true,
      riskLevel: true,
    },
  });

  const scoresByUserId = new Map<
    string,
    Array<{ pillar: string; score: number; riskLevel: string }>
  >();
  for (const s of allScores) {
    const userId = assessmentIdToUserId.get(s.assessmentId);
    if (!userId) continue;
    const list = scoresByUserId.get(userId) ?? [];
    list.push({ pillar: s.pillar, score: s.score, riskLevel: s.riskLevel });
    scoresByUserId.set(userId, list);
  }

  return assignments.map((a) => ({
    clientId: a.clientId,
    clientName: a.client.name ?? a.client.email,
    pillarScores: scoresByUserId.get(a.clientId) ?? [],
  }));
}