import { describe, expect, it } from "vitest";
import { formatTriggerSummary } from "@/lib/recommendations/format-trigger";

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
});
