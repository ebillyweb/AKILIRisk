import { describe, expect, it, vi, beforeEach } from "vitest";
import { syncAssessmentCompletionStatus } from "@/lib/assessment/assessment-completion";

function mockTx(overrides: {
  includedPillars?: string[];
  scoredPillars?: string[];
}) {
  const scored = overrides.scoredPillars ?? [];
  const includedPillars = overrides.includedPillars ?? [];

  const assessmentUpdate = vi.fn().mockResolvedValue({});
  const enterPreview = vi.fn().mockResolvedValue(undefined);

  const tx = {
    pillarScore: {
      findMany: vi.fn().mockResolvedValue(
        scored.map((pillar) => ({ pillar })),
      ),
    },
    assessment: {
      findUnique: vi.fn().mockResolvedValue({ includedPillars }),
      update: assessmentUpdate,
    },
  };

  return { tx, assessmentUpdate, enterPreview };
}

vi.mock("@/lib/methodology/cached-pillar-catalog", async () => {
  const { starterPillarCatalog } = await import("@/lib/methodology/pillar-catalog");
  return {
    getPlatformPillarCatalog: vi.fn(async () => starterPillarCatalog()),
    getPlatformPillarSlugs: vi.fn(async () => starterPillarCatalog().map((p) => p.id)),
    isPlatformRiskAreaSlug: vi.fn(async (slug: string) => starterPillarCatalog().some((p) => p.id === slug)),
  };
});

vi.mock("@/lib/assessment/deliverable-phase", () => ({
  enterPreview: vi.fn().mockResolvedValue(undefined),
}));

import { enterPreview } from "@/lib/assessment/deliverable-phase";

describe("syncAssessmentCompletionStatus", () => {
  beforeEach(() => {
    vi.mocked(enterPreview).mockClear();
  });

  it("marks COMPLETED when one included pillar is scored", async () => {
    const { tx, assessmentUpdate } = mockTx({
      includedPillars: ["governance"],
      scoredPillars: ["governance"],
    });

    const result = await syncAssessmentCompletionStatus(
      tx as never,
      "assess-1",
    );

    expect(result.allPillarsScored).toBe(true);
    expect(assessmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "COMPLETED" }),
      }),
    );
    expect(enterPreview).toHaveBeenCalled();
  });

  it("stays IN_PROGRESS when three-pillar scope has only two scored", async () => {
    const { tx, assessmentUpdate } = mockTx({
      includedPillars: ["governance", "cyber-digital", "insurance"],
      scoredPillars: ["governance", "cyber-digital"],
    });

    const result = await syncAssessmentCompletionStatus(
      tx as never,
      "assess-2",
    );

    expect(result.allPillarsScored).toBe(false);
    expect(assessmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "IN_PROGRESS",
          completedAt: null,
        }),
      }),
    );
    expect(enterPreview).not.toHaveBeenCalled();
  });

  it("marks COMPLETED for legacy empty includedPillars when all pillars scored", async () => {
    const { tx, assessmentUpdate } = mockTx({
      includedPillars: [],
      scoredPillars: [
        "governance",
        "cyber-digital",
        "physical-security",
        "insurance",
        "geographic-environmental",
        "reputational-social",
        "liquidity-cash",
        "tax-exposure",
        "estate-succession",
        "ai-emerging-tech",
      ],
    });

    const result = await syncAssessmentCompletionStatus(
      tx as never,
      "assess-3",
    );

    expect(result.allPillarsScored).toBe(true);
    expect(assessmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "COMPLETED" }),
      }),
    );
  });
});
