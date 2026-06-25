import { describe, expect, it, vi } from "vitest";
import { resolvePillarNarrativesForAssessment } from "@/lib/methodology/assessment-runtime";

vi.mock("@/lib/methodology/snapshot", () => ({
  loadSnapshotForAssessment: vi.fn(async () => ({
    schemaVersion: 2,
    catalogVersion: 1,
    includedPillarSlugs: ["governance"],
    pillars: [],
    assessmentQuestions: { governance: [] },
    intakeQuestions: [],
    pillarNarratives: {
      governance: {
        pillarId: "p1",
        slug: "governance",
        allNegative: ["Snapshotted negative copy"],
        allYes: ["Snapshotted yes copy"],
        midBand: { critical: ["Snapshotted critical"], high: [], medium: [], low: [] },
        version: 1,
      },
    },
    recRules: [],
    snapshotId: "snap-1",
    advisorProfileId: "adv-1",
    takenAt: new Date(),
  })),
}));

vi.mock("@/lib/methodology/assessment-from-snapshot", () => ({
  pillarAssessmentConfigFromSnapshot: vi.fn(() => ({
    pillarData: { id: "governance", subCategories: [{ id: "governance", questionIds: ["q1"] }] },
    questions: [
      {
        id: "q1",
        subCategory: "governance",
        type: "maturity-scale",
        scoreMap: { "0": 0, "1": 1, "2": 2, "3": 3 },
      },
    ],
  })),
}));

vi.mock("@/lib/methodology/cached-pillar-catalog", async () => {
  const { starterPillarCatalog } = await import("@/lib/methodology/pillar-catalog");
  return {
    getPlatformPillarCatalog: vi.fn(async () => starterPillarCatalog()),
    getPlatformPillarSlugs: vi.fn(async () => starterPillarCatalog().map((p) => p.id)),
    isPlatformRiskAreaSlug: vi.fn(async (slug: string) => starterPillarCatalog().some((p) => p.id === slug)),
  };
});

describe("resolvePillarNarrativesForAssessment", () => {
  it("prefers snapshotted narrative bands over live TS constants", async () => {
    const narratives = await resolvePillarNarrativesForAssessment(
      "asmt-1",
      "governance",
      0,
      "critical",
      { q1: 0 },
    );
    expect(narratives).toEqual(["Snapshotted critical"]);
  });
});
