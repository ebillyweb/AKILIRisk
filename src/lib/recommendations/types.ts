import type {
  AdvisorPriority,
  DeliverablePhase,
  RecommendationStatus,
  RecommendationTier,
  TaskStatus,
  ValidationStatus,
} from "@prisma/client";
import type { DisplayNarrative } from "@/lib/assessment/recommendations/llm-narrative/narrative-display";
import type { NarrativeReview } from "@/lib/assessment/recommendations/llm-narrative/narrative-review";

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

// ---------------------------------------------------------------------------
// Phase 22: Guidance Package types (per-client, cross-assessment)
// ---------------------------------------------------------------------------

/** Single item in the advisor Guidance Package, extending the portfolio item. */
export type GuidancePackageItem = PortfolioRecommendationItem & {
  advisorPriority: AdvisorPriority | null;
  hiddenFromClient: boolean;
  taskStatus: TaskStatus;
  validationStatus: ValidationStatus;
  requiresValidation: boolean;
  deferredReason: string | null;
  deferredRevisitDate: string | null;
  deferredTriggerEvent: string | null;
  responsibleRoles: string[];
  assignees: unknown;
  timeHorizon: string | null;
  /** Assessment IDs that triggered this recommendation (dedup merge). */
  assessmentSources: string[];
  /** Union of trigger reasons from all source assessments. */
  mergedEvidence: unknown[];
  /** AI-drafted narrative for advisor review (null when none generated). */
  aiNarrative: DisplayNarrative | null;
  /** Review state of the AI narrative (pending/approved, edited flag). */
  aiNarrativeReview: NarrativeReview | null;
};

/** Aggregate counts for the guidance package. */
export type GuidancePackageSummary = {
  totalItems: number;
  includedCount: number;
  deferredCount: number;
  completedCount: number;
  inProgressCount: number;
  hiddenCount: number;
};

/** Per-client guidance package: the holistic view across all assessments. */
export type GuidancePackage = {
  clientId: string;
  clientName: string;
  items: GuidancePackageItem[];
  summary: GuidancePackageSummary;
};

/** Input for deferring a recommendation (D-08). */
export type DeferInput = {
  recommendationId: string;
  reason: string;
  revisitDate?: string;
  triggerEvent?: string;
  notes?: string;
};

/** Input for bulk include/defer actions. */
export type BulkActionInput = {
  recommendationIds: string[];
  action: "INCLUDE" | "DEFER";
  deferReason?: string;
  deferRevisitDate?: string;
};
