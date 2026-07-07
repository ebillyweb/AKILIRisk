import { describe, expect, it, vi } from "vitest";
import { resolveClientAssessmentIncludedPillars } from "@/lib/client/assessment-scope";
import { ASSESSMENT_PILLAR_IDS } from "@/lib/assessment/pillar-registry";

vi.mock("@/lib/methodology/cached-pillar-catalog", () => ({
  getPlatformPillarCatalog: vi.fn(async () => {
    const { starterPillarCatalog } = await import("@/lib/methodology/pillar-catalog");
    return starterPillarCatalog();
  }),
  getPlatformPillarSlugs: vi.fn(async () => {
    const { starterPillarCatalog } = await import("@/lib/methodology/pillar-catalog");
    return starterPillarCatalog().map(p => p.id);
  }),
}));

describe("resolveClientAssessmentIncludedPillars", () => {
  it("uses approval scope before an assessment row exists", async () => {
    expect(
      await resolveClientAssessmentIncludedPillars({
        approvedScopeIncludedPillars: ["governance", "cyber-digital"],
        hasAssessmentRow: false,
      }),
    ).toEqual(["governance", "cyber-digital"]);
  });

  it("returns empty when locked with no assessment or approval scope", async () => {
    expect(
      await resolveClientAssessmentIncludedPillars({
        hasAssessmentRow: false,
      }),
    ).toEqual([]);
  });

  it("prefers non-empty assessment scope over approval", async () => {
    expect(
      await resolveClientAssessmentIncludedPillars({
        assessmentIncludedPillars: ["insurance"],
        approvedScopeIncludedPillars: ["governance"],
        hasAssessmentRow: true,
      }),
    ).toEqual(["insurance"]);
  });

  it("falls back to all pillars for legacy empty assessment scope", async () => {
    expect(
      await resolveClientAssessmentIncludedPillars({
        assessmentIncludedPillars: [],
        hasAssessmentRow: true,
      }),
    ).toEqual([...ASSESSMENT_PILLAR_IDS]);
  });
});
