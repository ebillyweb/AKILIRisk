import type { RecommendationCondition } from "@/lib/admin/recommendation-rule-schemas";

/** Default trigger for advisor-authored custom recommendation rules. */
export function defaultCustomRecommendationConditions(
  pillarSlug: string,
): RecommendationCondition[] {
  return [
    {
      type: "risk_level",
      pillarId: pillarSlug,
      operator: "in",
      value: ["high", "critical"],
      weight: 1,
    },
  ];
}
