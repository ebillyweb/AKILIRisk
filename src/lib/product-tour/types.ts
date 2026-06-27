export const TOUR_IDS = [
  "admin-recommendation-catalog",
  "admin-recommendation-service-form",
  "admin-recommendation-rules-list",
  "admin-recommendation-rule-form",
  "admin-intake-questions",
  "admin-intake-question-edit",
  "admin-assessment-questions-index",
  "admin-assessment-questions-area",
  "admin-assessment-question-form",
  "admin-scoring-thresholds",
  "admin-platform-settings",
  "advisor-methodology-hub",
  "advisor-methodology-pillars",
  "advisor-methodology-intake",
  "advisor-methodology-questions",
  "advisor-methodology-narratives",
  "advisor-methodology-preview",
  "advisor-methodology-versions",
  "advisor-methodology-catalog-updates",
  "advisor-recommendation-rules",
  "advisor-settings",
  "advisor-settings-pii-policy",
  "advisor-settings-team",
  "enterprise-recommendation-rules-index",
  "enterprise-recommendation-rules",
  "advisor-pipeline",
  "advisor-pipeline-client",
] as const;

export type TourId = (typeof TOUR_IDS)[number];

export type TourStepDefinition = {
  element?: string;
  popover: {
    title: string;
    description: string;
    side?: "top" | "right" | "bottom" | "left";
    align?: "start" | "center" | "end";
  };
};
