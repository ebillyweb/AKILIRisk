import { describe, it, expect, vi } from "vitest";

// Mock server-only (no-op in tests)
vi.mock("server-only", () => ({}));

// Mock the DB and server-only imports so the module can load
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/signals/emit", () => ({
  resolveClientDisplayName: vi.fn(),
}));
vi.mock("@/lib/recommendations/compose-solution", () => ({
  composeSolution: vi.fn(),
}));
vi.mock("@/lib/recommendations/format-trigger", () => ({
  formatTriggerSummary: vi.fn(),
}));
vi.mock("@/lib/recommendations/override-policy", () => ({
  getRecommendationPolicies: vi.fn(() => []),
}));

import {
  deduplicateRecommendations,
  type AssessmentRecommendationWithService,
} from "./guidance-package";

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function makeRec(
  overrides: Partial<AssessmentRecommendationWithService> = {}
): AssessmentRecommendationWithService {
  return {
    id: "rec-1",
    assessmentId: "assess-1",
    serviceRecommendationId: "svc-1",
    urgencyScore: 50,
    triggerReason: { reasons: ["Missing coverage"] },
    status: "GENERATED",
    priority: 1,
    advisorNotes: null,
    advisorPriority: null,
    hiddenFromClient: false,
    taskStatus: "NOT_STARTED",
    validationStatus: "PENDING_REVIEW",
    requiresValidation: false,
    deferredReason: null,
    deferredRevisitDate: null,
    deferredTriggerEvent: null,
    responsibleRoles: [],
    assignees: null,
    timeHorizon: null,
    serviceRecommendation: {
      id: "svc-1",
      name: "Cyber Insurance Review",
      category: "Insurance",
      description: "Review cyber coverage",
      tier: "BASELINE",
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("deduplicateRecommendations", () => {
  it("deduplicates two recs with same serviceRecommendationId, keeps highest urgency", () => {
    const recs = [
      makeRec({
        id: "rec-1",
        assessmentId: "assess-1",
        serviceRecommendationId: "svc-1",
        urgencyScore: 40,
        triggerReason: { reasons: ["Low coverage"] },
      }),
      makeRec({
        id: "rec-2",
        assessmentId: "assess-2",
        serviceRecommendationId: "svc-1",
        urgencyScore: 80,
        triggerReason: { reasons: ["Critical gap found"] },
      }),
    ];

    const result = deduplicateRecommendations(recs);

    expect(result).toHaveLength(1);
    expect(result[0].primaryId).toBe("rec-2"); // highest urgency
    expect(result[0].urgencyScore).toBe(80);
    expect(result[0].assessmentSources).toEqual(["assess-2", "assess-1"]);
    expect(result[0].mergedEvidence).toEqual([
      "Critical gap found",
      "Low coverage",
    ]);
  });

  it("three recs across two services produce two results", () => {
    const recs = [
      makeRec({
        id: "rec-1",
        assessmentId: "assess-1",
        serviceRecommendationId: "svc-1",
        urgencyScore: 60,
      }),
      makeRec({
        id: "rec-2",
        assessmentId: "assess-2",
        serviceRecommendationId: "svc-1",
        urgencyScore: 70,
      }),
      makeRec({
        id: "rec-3",
        assessmentId: "assess-1",
        serviceRecommendationId: "svc-2",
        urgencyScore: 90,
        serviceRecommendation: {
          id: "svc-2",
          name: "Estate Planning",
          category: "Legal",
          description: "Estate review",
          tier: "ENHANCED",
        },
      }),
    ];

    const result = deduplicateRecommendations(recs);

    expect(result).toHaveLength(2);
    const svc1 = result.find((r) => r.serviceRecommendationId === "svc-1");
    const svc2 = result.find((r) => r.serviceRecommendationId === "svc-2");
    expect(svc1).toBeDefined();
    expect(svc2).toBeDefined();
    expect(svc1!.primaryId).toBe("rec-2"); // higher urgency
    expect(svc1!.assessmentSources).toHaveLength(2);
    expect(svc2!.primaryId).toBe("rec-3");
    expect(svc2!.assessmentSources).toHaveLength(1);
  });

  it("single rec (no dedup needed) passes through unchanged", () => {
    const recs = [
      makeRec({
        id: "rec-1",
        assessmentId: "assess-1",
        serviceRecommendationId: "svc-1",
        urgencyScore: 55,
        triggerReason: { reasons: ["Some reason"] },
      }),
    ];

    const result = deduplicateRecommendations(recs);

    expect(result).toHaveLength(1);
    expect(result[0].primaryId).toBe("rec-1");
    expect(result[0].urgencyScore).toBe(55);
    expect(result[0].assessmentSources).toEqual(["assess-1"]);
    expect(result[0].mergedEvidence).toEqual(["Some reason"]);
  });

  it("handles array and non-array triggerReason formats for evidence merging", () => {
    const recs = [
      makeRec({
        id: "rec-1",
        assessmentId: "assess-1",
        serviceRecommendationId: "svc-1",
        urgencyScore: 60,
        triggerReason: ["evidence-a", "evidence-b"], // array format
      }),
      makeRec({
        id: "rec-2",
        assessmentId: "assess-2",
        serviceRecommendationId: "svc-1",
        urgencyScore: 70,
        triggerReason: { reasons: ["structured-evidence"] }, // object format
      }),
      makeRec({
        id: "rec-3",
        assessmentId: "assess-3",
        serviceRecommendationId: "svc-1",
        urgencyScore: 30,
        triggerReason: "plain-string-evidence", // plain value
      }),
    ];

    const result = deduplicateRecommendations(recs);

    expect(result).toHaveLength(1);
    // Primary is rec-2 (highest urgency 70), then rec-1 (60), then rec-3 (30)
    expect(result[0].primaryId).toBe("rec-2");
    // All evidence should be merged
    expect(result[0].mergedEvidence).toEqual([
      "structured-evidence",
      "evidence-a",
      "evidence-b",
      "plain-string-evidence",
    ]);
  });

  it("handles null triggerReason gracefully", () => {
    const recs = [
      makeRec({
        id: "rec-1",
        assessmentId: "assess-1",
        serviceRecommendationId: "svc-1",
        urgencyScore: 50,
        triggerReason: null,
      }),
    ];

    const result = deduplicateRecommendations(recs);

    expect(result).toHaveLength(1);
    expect(result[0].mergedEvidence).toEqual([]);
  });

  it("handles null urgencyScore (treats as 0)", () => {
    const recs = [
      makeRec({
        id: "rec-1",
        assessmentId: "assess-1",
        serviceRecommendationId: "svc-1",
        urgencyScore: null,
      }),
      makeRec({
        id: "rec-2",
        assessmentId: "assess-2",
        serviceRecommendationId: "svc-1",
        urgencyScore: 10,
      }),
    ];

    const result = deduplicateRecommendations(recs);

    expect(result).toHaveLength(1);
    expect(result[0].primaryId).toBe("rec-2"); // 10 > 0 (null treated as 0)
  });
});
