import { describe, expect, it } from "vitest";
import { resolveClientAssessmentIncludedPillars } from "@/lib/client/assessment-scope";
import { ASSESSMENT_PILLAR_IDS } from "@/lib/assessment/pillar-registry";

describe("resolveClientAssessmentIncludedPillars", () => {
  it("uses approval scope before an assessment row exists", () => {
    expect(
      resolveClientAssessmentIncludedPillars({
        approvedScopeIncludedPillars: ["governance", "cyber-digital"],
        hasAssessmentRow: false,
      }),
    ).toEqual(["governance", "cyber-digital"]);
  });

  it("returns empty when locked with no assessment or approval scope", () => {
    expect(
      resolveClientAssessmentIncludedPillars({
        hasAssessmentRow: false,
      }),
    ).toEqual([]);
  });

  it("prefers non-empty assessment scope over approval", () => {
    expect(
      resolveClientAssessmentIncludedPillars({
        assessmentIncludedPillars: ["insurance"],
        approvedScopeIncludedPillars: ["governance"],
        hasAssessmentRow: true,
      }),
    ).toEqual(["insurance"]);
  });

  it("falls back to all six for legacy empty assessment scope", () => {
    expect(
      resolveClientAssessmentIncludedPillars({
        assessmentIncludedPillars: [],
        hasAssessmentRow: true,
      }),
    ).toEqual([...ASSESSMENT_PILLAR_IDS]);
  });
});
