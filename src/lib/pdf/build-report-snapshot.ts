/**
 * §4.5 commit 3 (BRD §4.5): build the JSON snapshot persisted on a
 * PUBLISHED `Report.snapshotData` column. The snapshot is shaped exactly
 * the way `AssessmentReport`'s `data` prop expects, so a future render
 * is `<AssessmentReport data={snapshot.reportData} householdProfile={
 * snapshot.householdProfile} />` with no live database reads (beyond
 * Report row + auth assignment).
 *
 * This mirrors the data-shaping logic in `/api/reports/[id]/pdf/route.tsx`
 * — the route is the canonical reference for "what the live PDF looks
 * like." Any change here that diverges from the route's render would
 * mean published reports stop matching what an unsnapshotted render
 * would have produced. Tests assert structural parity.
 */

import { prisma } from "@/lib/db";
import { RELATIONSHIP_LABELS } from "@/lib/schemas/profile";
import { getAdvisorBrandingForPDF } from "@/lib/pdf/branding-integration";
import { getHouseholdProfileForAdvisorView } from "@/lib/household/member-profile";
import { getPillarAssessmentConfig } from "@/lib/assessment/pillar-config";
import { loadAssessmentAnswersForQuestions } from "@/lib/assessment/pillar-answer-loader";
import { resolvePillarNarratives } from "@/lib/assessment/pillar-outcomes";
import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import type { AdvisorBrandingData } from "@/lib/validation/branding";
// Re-exported types intentionally narrow — the snapshot is the storage
// boundary, not a public API. Consumers use `ReportSnapshot` directly.

interface CategoryScore {
  name: string;
  score: number;
  maxScore: number;
  subcategoryCount: number;
}

interface MissingControl {
  category: string;
  subcategory: string;
  description: string;
  recommendation: string;
  severity: "high" | "medium" | "low";
  advisorNotes?: string;
}

interface PillarScoreLite {
  pillar: string;
  score: number;
  riskLevel: string;
}

interface SnapshotHouseholdMember {
  displayLabel: string;
  relationship: string;
  birthYear: number | null;
  sex: string | null;
  governanceRoles: string[];
  isResident: boolean;
}

/**
 * Shape persisted on `Report.snapshotData`. Versioned implicitly by the
 * `schemaVersion` field — bump when the shape changes and add a
 * migration path to read older versions.
 */
export interface ReportSnapshot {
  schemaVersion: 1;
  /** Pillar that was the "primary" pillar at publish time — drives the
   *  Executive Summary's score + risk level + breakdown. Mirrors the
   *  route's "first PillarScore by calculatedAt desc" or the explicit
   *  `?pillar=` query param. */
  pillar: string;
  reportData: {
    score: number;
    riskLevel: string;
    breakdown: CategoryScore[];
    missingControls: MissingControl[];
    /** Canonical all-no / all-yes pillar copy; empty for mixed maturity. */
    pillarNarratives: string[];
    assessmentDate: string;
    completionPercentage: number;
    categoryCount: number;
    missingControlsCount: number;
    pillarScores: PillarScoreLite[];
  };
  householdProfile: { members: SnapshotHouseholdMember[] } | null;
}

/** Same priority → severity bucket logic the route uses. Kept in lockstep. */
function severityFromPriority(priority: number): "high" | "medium" | "low" {
  if (priority <= 3) return "high";
  if (priority <= 6) return "medium";
  return "low";
}

interface BuildSnapshotOptions {
  /** Optional: if provided, the snapshot is built from this specific
   *  pillar (mirroring the `?pillar=` query param on the live route).
   *  Defaults to the most recently calculated PillarScore. */
  pillar?: string | null;
}

/**
 * Build a structural snapshot of the assessment as it exists right now.
 * Pure read-only; no side effects. Throws when no PillarScore exists
 * (the assessment hasn't been scored — there's nothing to snapshot).
 */
export async function buildReportSnapshot(
  assessmentId: string,
  options: BuildSnapshotOptions = {}
): Promise<ReportSnapshot> {
  const requestedPillar = options.pillar ?? null;

  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: {
      id: true,
      userId: true,
      startedAt: true,
    },
  });
  if (!assessment) {
    throw new Error(`Assessment not found: ${assessmentId}`);
  }

  const pillarScore = requestedPillar
    ? await prisma.pillarScore.findUnique({
        where: {
          assessmentId_pillar: {
            assessmentId,
            pillar: requestedPillar,
          },
        },
      })
    : await prisma.pillarScore.findFirst({
        where: { assessmentId },
        orderBy: { calculatedAt: "desc" },
      });

  if (!pillarScore) {
    throw new Error(
      `Cannot snapshot assessment ${assessmentId}: no PillarScore rows. ` +
        `Score the assessment before publishing a report.`
    );
  }

  const responseCount = await prisma.assessmentResponse.count({
    where: { assessmentId, skipped: false },
  });
  // Identical estimate the live route uses (68 questions). Stable for
  // snapshots — future routes that compute completion% differently will
  // need a snapshot schemaVersion bump.
  const estimatedTotalQuestions = 68;
  const completionPercentage = Math.min(
    100,
    Math.round((responseCount / estimatedTotalQuestions) * 100)
  );

  const householdProfileRaw = await getHouseholdProfileForAdvisorView(assessment.userId);
  const householdProfile = householdProfileRaw
    ? {
        members: householdProfileRaw.members.map((m) => ({
          displayLabel: m.displayLabel,
          relationship: RELATIONSHIP_LABELS[m.relationship] ?? m.relationship,
          birthYear: m.birthYear ?? null,
          sex: m.sex ?? null,
          governanceRoles: m.governanceRoles,
          isResident: m.isResident,
        })),
      }
    : null;

  // Recommendations — prefer AssessmentRecommendation (commit 1 path).
  const assessmentRecommendations = await prisma.assessmentRecommendation.findMany({
    where: { assessmentId },
    orderBy: { priority: "asc" },
    select: {
      priority: true,
      advisorNotes: true,
      serviceRecommendation: {
        select: { name: true, description: true, category: true },
      },
    },
  });

  const legacyMissingControls = (pillarScore.missingControls ?? []) as unknown as MissingControl[];

  const missingControls: MissingControl[] = assessmentRecommendations.length > 0
    ? assessmentRecommendations.map((rec) => ({
        category: rec.serviceRecommendation.category,
        subcategory: rec.serviceRecommendation.name,
        description: `Gap identified in ${rec.serviceRecommendation.category}.`,
        recommendation: rec.serviceRecommendation.description,
        severity: severityFromPriority(rec.priority),
        advisorNotes: rec.advisorNotes ?? undefined,
      }))
    : legacyMissingControls.map((control) => ({
        category: control.category,
        subcategory: control.subcategory || control.category,
        description: control.description,
        recommendation: control.recommendation,
        severity: control.severity,
      }));

  const breakdown = (pillarScore.breakdown ?? []) as unknown as CategoryScore[];

  const allPillarScores = await prisma.pillarScore.findMany({
    where: { assessmentId },
    select: { pillar: true, score: true, riskLevel: true },
  });

  const assessmentDate = assessment.startedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const pillarSlug = normalizePillarSlug(pillarScore.pillar);
  const pillarConfig = await getPillarAssessmentConfig(pillarSlug);
  let pillarNarratives: string[] = [];
  if (pillarConfig) {
    const questionIds = pillarConfig.questions.map((q) => q.id);
    const answers = await loadAssessmentAnswersForQuestions(assessmentId, questionIds);
    pillarNarratives = resolvePillarNarratives(
      pillarSlug,
      pillarScore.score,
      pillarScore.riskLevel,
      answers,
      pillarConfig.questions
    );
  }

  return {
    schemaVersion: 1,
    pillar: pillarScore.pillar,
    reportData: {
      score: pillarScore.score,
      riskLevel: pillarScore.riskLevel.toLowerCase(),
      breakdown: breakdown.map((cat) => ({
        name: cat.name,
        score: cat.score,
        maxScore: cat.maxScore,
        subcategoryCount: breakdown.filter((b) => b.name === cat.name).length || 1,
      })),
      missingControls,
      pillarNarratives,
      assessmentDate,
      completionPercentage,
      categoryCount: breakdown.length,
      missingControlsCount: missingControls.length,
      pillarScores: allPillarScores.map((p) => ({
        pillar: p.pillar,
        score: p.score,
        riskLevel: p.riskLevel,
      })),
    },
    householdProfile,
  };
}

/**
 * Resolve the active advisor's branding at publish time. Captures into
 * `Report.brandingSnapshot` so future reads of the published report
 * keep the firm name + logo + colors as they were on publish day, even
 * if the advisor later renames their firm.
 *
 * Returns null when no active advisor is assigned to the assessment
 * owner. The renderer falls back to the Belvedere lockup in that case.
 */
export async function buildBrandingSnapshot(
  assessmentId: string
): Promise<AdvisorBrandingData | null> {
  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: {
      client: { assessments: { some: { id: assessmentId } } },
      status: "ACTIVE",
    },
    select: { advisorId: true },
  });
  if (!assignment) return null;
  return getAdvisorBrandingForPDF(assignment.advisorId);
}
