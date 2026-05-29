import type { DeliverablePhase, RecommendationStatus, RecommendationTier } from "@prisma/client";

export type PortfolioRecommendationItem = {
  id: string;
  serviceRecommendationId: string;
  serviceName: string;
  category: string;
  description: string;
  tier: RecommendationTier | null;
  priority: number;
  status: RecommendationStatus;
  triggerSummary: string;
  advisorNotes: string | null;
};

export type ClientRecommendationGroup = {
  clientId: string;
  clientName: string;
  assessmentId: string;
  deliverablePhase: DeliverablePhase;
  completedAt: string | null;
  hasDraftReport: boolean;
  hasPublishedReport: boolean;
  editReportHref: string;
  intelligenceHref: string;
  recommendations: PortfolioRecommendationItem[];
};

export type PortfolioRecommendationsSummary = {
  assignedClients: number;
  clientsWithRecommendations: number;
  totalRecommendations: number;
  pendingCount: number;
  actionNeededCount: number;
};

export type PortfolioRecommendations = {
  summary: PortfolioRecommendationsSummary;
  groups: ClientRecommendationGroup[];
};

export type PortfolioRecommendationsFilters = {
  status?: "pending" | "all";
  category?: string;
  actionNeededOnly?: boolean;
};
