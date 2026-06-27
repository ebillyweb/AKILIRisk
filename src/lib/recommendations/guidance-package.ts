import "server-only";

import { prisma } from "@/lib/db";
import { resolveClientDisplayName } from "@/lib/signals/emit";
import { composeSolution } from "@/lib/recommendations/compose-solution";
import { formatTriggerSummary } from "@/lib/recommendations/format-trigger";
import { getRecommendationPolicies } from "@/lib/recommendations/override-policy";
import type {
  GuidancePackage,
  GuidancePackageItem,
  GuidancePackageSummary,
} from "@/lib/recommendations/types";

// ---------------------------------------------------------------------------
// Deduplication (pure function, exported for testing)
// ---------------------------------------------------------------------------

/**
 * Intermediate type representing a deduplicated recommendation group.
 * Groups by serviceRecommendationId, keeping the highest-urgency instance
 * as primary and merging evidence from all instances.
 */
export type MergedRecommendation = {
  /** AssessmentRecommendation id with highest urgency */
  primaryId: string;
  serviceRecommendationId: string;
  urgencyScore: number;
  /** All assessment IDs that triggered this recommendation */
  assessmentSources: string[];
  /** Union of trigger reasons from all source assessments */
  mergedEvidence: unknown[];
  /** Status from the primary (highest urgency) instance */
  status: string;
  /** The full primary record for downstream mapping */
  primary: AssessmentRecommendationWithService;
};

/**
 * Minimal shape of AssessmentRecommendation with included serviceRecommendation
 * for dedup input.
 */
export type AssessmentRecommendationWithService = {
  id: string;
  assessmentId: string;
  serviceRecommendationId: string;
  urgencyScore: number | null;
  triggerReason: unknown;
  status: string;
  priority: number;
  advisorNotes: string | null;
  advisorPriority: string | null;
  hiddenFromClient: boolean;
  taskStatus: string;
  validationStatus: string;
  requiresValidation: boolean;
  deferredReason: string | null;
  deferredRevisitDate: Date | null;
  deferredTriggerEvent: string | null;
  responsibleRoles: string[];
  assignees: unknown;
  timeHorizon: string | null;
  serviceRecommendation: {
    id: string;
    name: string;
    category: string;
    description: string;
    tier: string | null;
  };
};

/**
 * Deduplicate recommendations by serviceRecommendationId across assessments.
 *
 * When the same ServiceRecommendation fires on multiple assessments for the
 * same client, this groups them, keeps the instance with the highest
 * urgencyScore as primary, and unions the triggerReason arrays as
 * mergedEvidence. (D-02, Pitfall 3)
 */
export function deduplicateRecommendations(
  recs: AssessmentRecommendationWithService[]
): MergedRecommendation[] {
  const byService = new Map<string, AssessmentRecommendationWithService[]>();
  for (const rec of recs) {
    const existing = byService.get(rec.serviceRecommendationId) ?? [];
    existing.push(rec);
    byService.set(rec.serviceRecommendationId, existing);
  }

  return [...byService.values()].map((group) => {
    // Sort by urgency descending, pick primary
    group.sort((a, b) => (b.urgencyScore ?? 0) - (a.urgencyScore ?? 0));
    const primary = group[0];
    return {
      primaryId: primary.id,
      serviceRecommendationId: primary.serviceRecommendationId,
      urgencyScore: primary.urgencyScore ?? 0,
      assessmentSources: group.map((r) => r.assessmentId),
      mergedEvidence: group.flatMap((r) => extractEvidence(r.triggerReason)),
      status: primary.status,
      primary,
    };
  });
}

/**
 * Extract evidence items from triggerReason, handling both array and
 * object-with-reasons-array formats consistently.
 */
function extractEvidence(triggerReason: unknown): unknown[] {
  if (Array.isArray(triggerReason)) return triggerReason;
  if (
    triggerReason &&
    typeof triggerReason === "object" &&
    "reasons" in (triggerReason as Record<string, unknown>)
  ) {
    const reasons = (triggerReason as { reasons: unknown }).reasons;
    return Array.isArray(reasons) ? reasons : [triggerReason];
  }
  if (triggerReason != null) return [triggerReason];
  return [];
}

// ---------------------------------------------------------------------------
// Main query function
// ---------------------------------------------------------------------------

/**
 * Build a per-client Guidance Package aggregating recommendations across
 * all completed assessments. (D-01, D-02)
 *
 * This is the central data structure consumed by advisor Guidance Review,
 * enterprise overlay preview, and client Strategic Action Plan.
 *
 * T-22-03 mitigation: advisorProfileId is received but downstream plan
 * actions validate advisor-client assignment before calling this function.
 */
export async function getGuidancePackageForClient(
  clientId: string,
  _advisorProfileId: string
): Promise<GuidancePackage> {
  // 1. Find all completed assessments for this client
  const assessments = await prisma.assessment.findMany({
    where: { userId: clientId, status: "COMPLETED" },
    select: { id: true, completedAt: true },
    orderBy: { completedAt: "desc" },
  });

  if (assessments.length === 0) {
    const clientName = await resolveClientDisplayName(clientId);
    return emptyPackage(clientId, clientName);
  }

  // 2. Query all recommendations across those assessments (Pitfall 1: batch)
  const assessmentIds = assessments.map((a) => a.id);
  const recs = await prisma.assessmentRecommendation.findMany({
    where: { assessmentId: { in: assessmentIds } },
    include: {
      serviceRecommendation: {
        select: {
          id: true,
          name: true,
          category: true,
          description: true,
          tier: true,
        },
      },
    },
    orderBy: { urgencyScore: "desc" },
  });

  // 3. Deduplicate by serviceRecommendationId
  const deduped = deduplicateRecommendations(
    recs as unknown as AssessmentRecommendationWithService[]
  );

  // 4. Resolve advisor context once
  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: { clientId, status: "ACTIVE" },
    select: {
      advisor: {
        select: {
          id: true,
          firmName: true,
          enterpriseId: true,
          enterprise: { select: { id: true, name: true } },
        },
      },
    },
  });

  const advisorProfile = assignment?.advisor ?? null;
  const enterprise = advisorProfile?.enterprise ?? null;

  // 5. Batch-fetch overlays (Pitfall 1: { in: serviceIds } pattern)
  const serviceIds = deduped.map((d) => d.serviceRecommendationId);

  const [enterpriseCustomizations, advisorCustomizations] = await Promise.all([
    enterprise
      ? prisma.enterpriseSolutionCustomization.findMany({
          where: {
            enterpriseId: enterprise.id,
            serviceRecommendationId: { in: serviceIds },
            isActive: true,
          },
        })
      : [],
    advisorProfile
      ? prisma.advisorSolutionCustomization.findMany({
          where: {
            advisorProfileId: advisorProfile.id,
            serviceRecommendationId: { in: serviceIds },
            isActive: true,
          },
        })
      : [],
  ]);

  const ecMap = new Map(
    enterpriseCustomizations.map((c) => [c.serviceRecommendationId, c])
  );
  const acMap = new Map(
    advisorCustomizations.map((c) => [c.serviceRecommendationId, c])
  );

  // 6-7. Compose each and build GuidancePackageItems
  const overridePolicies = getRecommendationPolicies();

  const items: GuidancePackageItem[] = deduped.map((merged) => {
    const { primary } = merged;

    const composed = composeSolution({
      service: primary.serviceRecommendation as Parameters<
        typeof composeSolution
      >[0]["service"],
      enterpriseCustomization: ecMap.get(merged.serviceRecommendationId),
      advisorCustomization: acMap.get(merged.serviceRecommendationId),
      enterpriseName: enterprise?.name,
      advisorName: advisorProfile?.firmName,
      overridePolicies,
    });

    return {
      // PortfolioRecommendationItem fields
      id: primary.id,
      serviceRecommendationId: primary.serviceRecommendationId,
      serviceName: composed.name,
      category: composed.category,
      description: composed.description,
      tier: primary.serviceRecommendation.tier as GuidancePackageItem["tier"],
      priority: primary.priority,
      status: primary.status as GuidancePackageItem["status"],
      triggerSummary: formatTriggerSummary(primary.triggerReason),
      advisorNotes: primary.advisorNotes,
      // GuidancePackageItem extensions
      advisorPriority:
        (primary.advisorPriority as GuidancePackageItem["advisorPriority"]) ??
        null,
      hiddenFromClient: primary.hiddenFromClient,
      taskStatus: primary.taskStatus as GuidancePackageItem["taskStatus"],
      validationStatus:
        primary.validationStatus as GuidancePackageItem["validationStatus"],
      requiresValidation: primary.requiresValidation,
      deferredReason: primary.deferredReason,
      deferredRevisitDate: primary.deferredRevisitDate?.toISOString() ?? null,
      deferredTriggerEvent: primary.deferredTriggerEvent,
      responsibleRoles: primary.responsibleRoles,
      assignees: primary.assignees,
      timeHorizon: primary.timeHorizon,
      assessmentSources: merged.assessmentSources,
      mergedEvidence: merged.mergedEvidence,
    };
  });

  // 8. Compute GuidancePackageSummary
  const summary = computeSummary(items);

  // 9. Resolve client display name
  const clientName = await resolveClientDisplayName(clientId);

  return { clientId, clientName, items, summary };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeSummary(items: GuidancePackageItem[]): GuidancePackageSummary {
  let includedCount = 0;
  let deferredCount = 0;
  let completedCount = 0;
  let inProgressCount = 0;
  let hiddenCount = 0;

  for (const item of items) {
    if (item.hiddenFromClient) hiddenCount += 1;
    switch (item.status) {
      case "INCLUDED":
        includedCount += 1;
        break;
      case "DEFERRED":
        deferredCount += 1;
        break;
      case "COMPLETED":
        completedCount += 1;
        break;
      case "IN_PROGRESS":
        inProgressCount += 1;
        break;
    }
  }

  return {
    totalItems: items.length,
    includedCount,
    deferredCount,
    completedCount,
    inProgressCount,
    hiddenCount,
  };
}

function emptyPackage(
  clientId: string,
  clientName: string
): GuidancePackage {
  return {
    clientId,
    clientName,
    items: [],
    summary: {
      totalItems: 0,
      includedCount: 0,
      deferredCount: 0,
      completedCount: 0,
      inProgressCount: 0,
      hiddenCount: 0,
    },
  };
}
