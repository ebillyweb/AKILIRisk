import "server-only";

import { prisma } from "@/lib/db";
import {
  composeSolution,
  type ComposedSolution,
} from "@/lib/recommendations/compose-solution";

/**
 * Load a composed solution for a single AssessmentRecommendation.
 *
 * Fetches the platform ServiceRecommendation, then looks up enterprise and
 * advisor overlays based on the assessment's ownership chain, and composes
 * them into a single view.
 */
export async function getComposedSolutionForRecommendation(
  assessmentRecommendationId: string
): Promise<ComposedSolution | null> {
  const rec = await prisma.assessmentRecommendation.findUnique({
    where: { id: assessmentRecommendationId },
    include: {
      serviceRecommendation: true,
      assessment: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!rec) return null;

  // Resolve advisor context for this client
  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: { clientId: rec.assessment.userId, status: "ACTIVE" },
    select: {
      advisorId: true,
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

  // Fetch overlays in parallel
  const [enterpriseCustomization, advisorCustomization] = await Promise.all([
    enterprise
      ? prisma.enterpriseSolutionCustomization.findUnique({
          where: {
            enterpriseId_serviceRecommendationId: {
              enterpriseId: enterprise.id,
              serviceRecommendationId: rec.serviceRecommendationId,
            },
          },
        })
      : null,
    advisorProfile
      ? prisma.advisorSolutionCustomization.findUnique({
          where: {
            advisorProfileId_serviceRecommendationId: {
              advisorProfileId: advisorProfile.id,
              serviceRecommendationId: rec.serviceRecommendationId,
            },
          },
        })
      : null,
  ]);

  return composeSolution({
    service: rec.serviceRecommendation,
    enterpriseCustomization,
    advisorCustomization,
    enterpriseName: enterprise?.name,
    advisorName: advisorProfile?.firmName,
  });
}

/**
 * Load composed solutions for all recommendations on an assessment.
 */
export async function getComposedSolutionsForAssessment(
  assessmentId: string
): Promise<Map<string, ComposedSolution>> {
  const recs = await prisma.assessmentRecommendation.findMany({
    where: { assessmentId },
    include: { serviceRecommendation: true },
    orderBy: { priority: "asc" },
  });

  if (recs.length === 0) return new Map();

  // Resolve advisor context
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { userId: true },
  });
  if (!assessment) return new Map();

  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: { clientId: assessment.userId, status: "ACTIVE" },
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

  // Batch-fetch all overlays
  const serviceIds = recs.map((r) => r.serviceRecommendationId);

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

  const result = new Map<string, ComposedSolution>();
  for (const rec of recs) {
    result.set(
      rec.id,
      composeSolution({
        service: rec.serviceRecommendation,
        enterpriseCustomization: ecMap.get(rec.serviceRecommendationId),
        advisorCustomization: acMap.get(rec.serviceRecommendationId),
        enterpriseName: enterprise?.name,
        advisorName: advisorProfile?.firmName,
      })
    );
  }

  return result;
}
