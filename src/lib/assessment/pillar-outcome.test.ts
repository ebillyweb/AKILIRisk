import { describe, it, expect, vi, beforeEach } from "vitest";
import { ASSESSMENT_PILLAR_IDS } from "@/lib/assessment/pillar-registry";
import { pillarNarrativeRecommendations } from "@/lib/assessment/pillar-outcomes";
import {
  GOVERNANCE_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  GOVERNANCE_ALL_NEGATIVE_SERVICE_IDS,
  PILLAR_ALL_NEGATIVE_EXPECTED_SERVICE_IDS,
} from "@/lib/assessment/pillar-outcome-expectations";
import { RecommendationEngine } from "@/lib/assessment/engines/recommendation-engine";
import {
  PRODUCTION_CATALOG_RULES,
  PRODUCTION_CATALOG_SERVICES_WITH_CYBER,
} from "@/lib/assessment/engines/recommendation-catalog-fixtures";
import {
  buildAllNoVisiblePillarAnswers,
  scorePillar,
  toPrismaCatalogMocks,
} from "@/lib/assessment/engines/recommendation-test-helpers";

const { rules, services } = toPrismaCatalogMocks(
  PRODUCTION_CATALOG_SERVICES_WITH_CYBER,
  PRODUCTION_CATALOG_RULES
);

const findManySpy = vi.fn();
const findUniqueSpy = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    recommendationRule: {
      findMany: (...args: unknown[]) => findManySpy(...args),
    },
    serviceRecommendation: {
      findUnique: (...args: unknown[]) => findUniqueSpy(...args),
    },
    assessmentRecommendation: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

beforeEach(() => {
  findManySpy.mockReset();
  findUniqueSpy.mockReset();
  findManySpy.mockResolvedValue(rules);
  findUniqueSpy.mockImplementation(({ where }: { where: { id: string } }) =>
    Promise.resolve(services.find((s) => s.id === where.id) ?? null)
  );
});

describe("Pillar assessment outcomes — all negative answers", () => {
  for (const pillarId of ASSESSMENT_PILLAR_IDS) {
    const expectedServices = PILLAR_ALL_NEGATIVE_EXPECTED_SERVICE_IDS[pillarId];

    it(`${pillarId}: lowest visible answers yield critical risk and missing controls`, () => {
      const { answers, visibleIds, questions } = buildAllNoVisiblePillarAnswers(pillarId);
      const score = scorePillar(pillarId, answers, visibleIds, questions);

      expect(score.riskLevel).toBe("critical");
      expect(score.score).toBeLessThan(1.2);
      expect(score.missingControls.length).toBeGreaterThan(0);
      expect(questions.length).toBeGreaterThan(0);
    });

    if (expectedServices?.length) {
      it(`${pillarId}: triggers expected catalog remediation services`, async () => {
        const { answers, visibleIds, questions } = buildAllNoVisiblePillarAnswers(pillarId);
        const score = scorePillar(pillarId, answers, visibleIds, questions);

        const engine = new RecommendationEngine();
        const recs = await engine.matchAndDedupeRecommendations({
          assessmentId: `as-pillar-${pillarId}`,
          userId: "u-pillar-test",
          pillarScores: {
            [pillarId]: { score: score.score, riskLevel: score.riskLevel },
          },
          answers,
          householdProfile: null,
          missingControls: score.missingControls,
        });

        const ids = recs.map((r) => r.id).sort();
        expect(ids).toEqual([...expectedServices].sort());
      });
    }
  }

  describe("governance pillar narrative recommendations", () => {
    it("returns estate planning and family governance narratives when every answer is negative", () => {
      const { answers, visibleIds, questions } = buildAllNoVisiblePillarAnswers("governance");
      const score = scorePillar("governance", answers, visibleIds, questions);

      const narratives = pillarNarrativeRecommendations(
        "governance",
        score,
        answers,
        questions
      );

      expect(narratives).toEqual([...GOVERNANCE_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS]);
      expect(narratives).toHaveLength(2);
      expect(narratives[0]).toMatch(/estate planning attorney/i);
      expect(narratives[1]).toMatch(/formal family governance structure/i);
    });

    it("does not return governance narratives when risk is low", () => {
      const { answers, visibleIds, questions } = buildAllNoVisiblePillarAnswers("governance");
      const score = scorePillar("governance", answers, visibleIds, questions);

      const narratives = pillarNarrativeRecommendations("governance", {
        ...score,
        riskLevel: "low",
      }, answers, questions);

      expect(narratives).toEqual([]);
    });

    it("triggers governance charter, advisor coordination, and succession services", async () => {
      const { answers, visibleIds, questions } = buildAllNoVisiblePillarAnswers("governance");
      const score = scorePillar("governance", answers, visibleIds, questions);

      const engine = new RecommendationEngine();
      const recs = await engine.matchAndDedupeRecommendations({
        assessmentId: "as-gov-narratives",
        userId: "u-gov",
        pillarScores: {
          governance: { score: score.score, riskLevel: score.riskLevel },
        },
        answers,
        householdProfile: null,
        missingControls: score.missingControls,
      });

      expect(recs.map((r) => r.id).sort()).toEqual(
        [...GOVERNANCE_ALL_NEGATIVE_SERVICE_IDS].sort()
      );
    });

  });
});
