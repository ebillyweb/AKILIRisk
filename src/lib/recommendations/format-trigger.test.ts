import { describe, expect, it } from "vitest";
import {
  extractRecommendationReasons,
  formatTriggerSummary,
} from "@/lib/recommendations/format-trigger";

describe("formatTriggerSummary", () => {
  it("returns default when empty", () => {
    expect(formatTriggerSummary(null)).toBe("Matched assessment rules");
  });

  it("joins reason strings", () => {
    expect(
      formatTriggerSummary({
        reasons: ["Score below threshold on governance", "Rule dma-01 matched"],
      })
    ).toContain("governance");
  });

  it("handles plain array format", () => {
    expect(
      formatTriggerSummary(["Cyber risk score 8.2 (critical)", "MFA not enabled"])
    ).toContain("Cyber risk score");
  });
});

describe("extractRecommendationReasons", () => {
  it("parses wrapped reasons objects", () => {
    expect(
      extractRecommendationReasons({
        reasons: [
          "Governance score 7.8 exceeds high-risk threshold",
          "No formal family charter documented",
        ],
      })
    ).toEqual([
      "Governance score 7.8 exceeds high-risk threshold",
      "No formal family charter documented",
    ]);
  });

  it("parses JSON-encoded arrays stored as strings", () => {
    expect(
      extractRecommendationReasons(
        '["Governance score 7.8 exceeds high-risk threshold","No formal family charter documented"]'
      )
    ).toEqual([
      "Governance score 7.8 exceeds high-risk threshold",
      "No formal family charter documented",
    ]);
  });
});
