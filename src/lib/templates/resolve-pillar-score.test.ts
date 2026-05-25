import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    pillarScore: {
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
  },
}));

import { loadPillarScoreForTemplate } from "./resolve-pillar-score";

beforeEach(() => {
  findUnique.mockReset();
});

describe("loadPillarScoreForTemplate", () => {
  it("loads canonical governance slug", async () => {
    findUnique.mockImplementation(
      async ({
        where,
      }: {
        where: { assessmentId_pillar: { pillar: string } };
      }) => {
        if (where.assessmentId_pillar.pillar === "governance") {
          return {
            pillar: "governance",
            score: 8,
            riskLevel: "LOW",
            breakdown: [],
            missingControls: [],
          };
        }
        return null;
      }
    );

    const result = await loadPillarScoreForTemplate("asmt-1", "governance");
    expect(result?.score).toBe(8);
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it("falls back to legacy family-governance slug", async () => {
    findUnique.mockImplementation(
      async ({
        where,
      }: {
        where: { assessmentId_pillar: { pillar: string } };
      }) => {
        if (where.assessmentId_pillar.pillar === "family-governance") {
          return {
            pillar: "family-governance",
            score: 6,
            riskLevel: "MEDIUM",
            breakdown: [],
            missingControls: [],
          };
        }
        return null;
      }
    );

    const result = await loadPillarScoreForTemplate("asmt-1", "governance");
    expect(result?.score).toBe(6);
    expect(findUnique.mock.calls[0][0].where.assessmentId_pillar.pillar).toBe(
      "governance"
    );
    expect(findUnique.mock.calls[1][0].where.assessmentId_pillar.pillar).toBe(
      "family-governance"
    );
  });
});
