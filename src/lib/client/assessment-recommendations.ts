import "server-only";

import type {
  ImplementationType,
  RecommendationStatus,
  RecommendationTier,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatTriggerSummary } from "@/lib/recommendations/format-trigger";

export type ClientFacilitatedRecommendation = {
  id: string;
  serviceName: string;
  description: string;
  category: string;
  priority: number;
  triggerSummary: string;
  advisorNotes: string | null;
  estimatedCost: string | null;
  timeframe: string | null;
  provider: string | null;
  implementationType: ImplementationType | null;
  tier: RecommendationTier;
  status: RecommendationStatus;
};

export async function getClientFacilitatedRecommendations(
  assessmentId: string,
  clientUserId: string,
): Promise<ClientFacilitatedRecommendation[]> {
  const assessment = await prisma.assessment.findFirst({
    where: { id: assessmentId, userId: clientUserId },
    select: { id: true },
  });
  if (!assessment) return [];

  const rows = await prisma.assessmentRecommendation.findMany({
    where: { assessmentId },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      priority: true,
      status: true,
      advisorNotes: true,
      triggerReason: true,
      serviceRecommendation: {
        select: {
          name: true,
          description: true,
          category: true,
          estimatedCost: true,
          timeframe: true,
          provider: true,
          implementationType: true,
          tier: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    serviceName: row.serviceRecommendation.name,
    description: row.serviceRecommendation.description,
    category: row.serviceRecommendation.category,
    priority: row.priority,
    triggerSummary: formatTriggerSummary(row.triggerReason),
    advisorNotes: row.advisorNotes,
    estimatedCost: row.serviceRecommendation.estimatedCost,
    timeframe: row.serviceRecommendation.timeframe,
    provider: row.serviceRecommendation.provider,
    implementationType: row.serviceRecommendation.implementationType,
    tier: row.serviceRecommendation.tier,
    status: row.status,
  }));
}
