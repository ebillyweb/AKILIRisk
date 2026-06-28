import { describe, expect, it } from "vitest";
import { inferPillarSlugFromRecommendationRule } from "@/lib/methodology/infer-recommendation-rule-pillar";

describe("inferPillarSlugFromRecommendationRule", () => {
  it("reads pillarId from risk_level / score_threshold conditions", () => {
    expect(
      inferPillarSlugFromRecommendationRule({
        triggerConditions: [
          {
            type: "risk_level",
            pillarId: "governance",
            operator: "in",
            value: ["high", "critical"],
          },
        ],
      }),
    ).toBe("governance");
  });

  it("infers governance from belvedere question ids", () => {
    expect(
      inferPillarSlugFromRecommendationRule({
        triggerConditions: [
          {
            type: "answer_match",
            questionId: "belvedere-gov-a5",
            operator: "equals",
            value: 0,
          },
        ],
      }),
    ).toBe("governance");
  });

  it("infers pillar from service recommendation id prefix", () => {
    expect(
      inferPillarSlugFromRecommendationRule({
        triggerConditions: [],
        serviceRecommendationId: "cyber_phishing_training",
      }),
    ).toBe("cyber-digital");
  });

  it("does not treat triggerConditions as a top-level object with pillarId", () => {
    expect(
      inferPillarSlugFromRecommendationRule({
        triggerConditions: {
          pillarId: "governance",
        },
      }),
    ).toBeNull();
  });
});
