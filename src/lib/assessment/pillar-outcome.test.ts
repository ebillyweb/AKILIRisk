import { describe, it, expect, vi, beforeEach } from "vitest";
import { ASSESSMENT_PILLAR_IDS } from "@/lib/assessment/pillar-registry";
import { pillarNarrativeRecommendations } from "@/lib/assessment/pillar-outcomes";
import {
  CYBER_DIGITAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  GOVERNANCE_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  GOVERNANCE_ALL_NEGATIVE_SERVICE_IDS,
  GEOGRAPHIC_ENVIRONMENTAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  INSURANCE_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  REPUTATIONAL_SOCIAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  PHYSICAL_SECURITY_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
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

  describe("reputational-social pillar narrative recommendations", () => {
    it("returns reputational risk narrative when every answer is negative", () => {
      const { answers, visibleIds, questions } = buildAllNoVisiblePillarAnswers(
        "reputational-social"
      );
      const score = scorePillar("reputational-social", answers, visibleIds, questions);

      const narratives = pillarNarrativeRecommendations(
        "reputational-social",
        score,
        answers,
        questions
      );

      expect(narratives).toEqual([...REPUTATIONAL_SOCIAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS]);
      expect(narratives[0]).toMatch(/managing reputational risk/i);
      expect(narratives[0]).toMatch(/digital footprint audit/i);
      expect(narratives[0]).toMatch(/reputational exposure review/i);
      expect(narratives[0]).toMatch(/crisis response protocols/i);
    });

    it("does not return reputational narratives when risk is low", () => {
      const { answers, visibleIds, questions } = buildAllNoVisiblePillarAnswers(
        "reputational-social"
      );
      const score = scorePillar("reputational-social", answers, visibleIds, questions);

      const narratives = pillarNarrativeRecommendations("reputational-social", {
        ...score,
        riskLevel: "low",
      }, answers, questions);

      expect(narratives).toEqual([]);
    });
  });

  describe("geographic-environmental pillar narrative recommendations", () => {
    it("returns geographic risk narrative when every answer is negative", () => {
      const { answers, visibleIds, questions } = buildAllNoVisiblePillarAnswers(
        "geographic-environmental"
      );
      const score = scorePillar("geographic-environmental", answers, visibleIds, questions);

      const narratives = pillarNarrativeRecommendations(
        "geographic-environmental",
        score,
        answers,
        questions
      );

      expect(narratives).toEqual([
        ...GEOGRAPHIC_ENVIRONMENTAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
      ]);
      expect(narratives[0]).toMatch(/geographic and environmental risk/i);
      expect(narratives[0]).toMatch(/geographic risk mapping/i);
      expect(narratives[0]).toMatch(/flood, wildfire, seismic/i);
    });

    it("does not return geographic narratives when risk is low", () => {
      const { answers, visibleIds, questions } = buildAllNoVisiblePillarAnswers(
        "geographic-environmental"
      );
      const score = scorePillar("geographic-environmental", answers, visibleIds, questions);

      const narratives = pillarNarrativeRecommendations("geographic-environmental", {
        ...score,
        riskLevel: "low",
      }, answers, questions);

      expect(narratives).toEqual([]);
    });
  });

  describe("insurance pillar narrative recommendations", () => {
    it("returns insurance coverage narrative when every answer is negative", () => {
      const { answers, visibleIds, questions } = buildAllNoVisiblePillarAnswers("insurance");
      const score = scorePillar("insurance", answers, visibleIds, questions);

      const narratives = pillarNarrativeRecommendations(
        "insurance",
        score,
        answers,
        questions
      );

      expect(narratives).toEqual([...INSURANCE_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS]);
      expect(narratives[0]).toMatch(/centralized oversight/i);
      expect(narratives[0]).toMatch(/comprehensive coverage audit/i);
      expect(narratives[0]).toMatch(/umbrella\/excess coverage/i);
      expect(narratives[0]).toMatch(/renewals, claims history/i);
    });

    it("does not return insurance narratives when risk is low", () => {
      const { answers, visibleIds, questions } = buildAllNoVisiblePillarAnswers("insurance");
      const score = scorePillar("insurance", answers, visibleIds, questions);

      const narratives = pillarNarrativeRecommendations("insurance", {
        ...score,
        riskLevel: "low",
      }, answers, questions);

      expect(narratives).toEqual([]);
    });
  });

  describe("physical-security pillar narrative recommendations", () => {
    it("returns physical security narrative when every answer is negative", () => {
      const { answers, visibleIds, questions } = buildAllNoVisiblePillarAnswers("physical-security");
      const score = scorePillar("physical-security", answers, visibleIds, questions);

      const narratives = pillarNarrativeRecommendations(
        "physical-security",
        score,
        answers,
        questions
      );

      expect(narratives).toEqual([...PHYSICAL_SECURITY_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS]);
      expect(narratives[0]).toMatch(/standard security and safety protocols/i);
      expect(narratives[0]).toMatch(/centralized security oversight/i);
      expect(narratives[0]).toMatch(/site security assessments/i);
      expect(narratives[0]).toMatch(/travel security protocols/i);
    });

    it("does not return physical security narratives when risk is low", () => {
      const { answers, visibleIds, questions } = buildAllNoVisiblePillarAnswers("physical-security");
      const score = scorePillar("physical-security", answers, visibleIds, questions);

      const narratives = pillarNarrativeRecommendations("physical-security", {
        ...score,
        riskLevel: "low",
      }, answers, questions);

      expect(narratives).toEqual([]);
    });
  });

  describe("cyber-digital pillar narrative recommendations", () => {
    it("returns cybersecurity framework narrative when every answer is negative", () => {
      const { answers, visibleIds, questions } = buildAllNoVisiblePillarAnswers("cyber-digital");
      const score = scorePillar("cyber-digital", answers, visibleIds, questions);

      const narratives = pillarNarrativeRecommendations(
        "cyber-digital",
        score,
        answers,
        questions
      );

      expect(narratives).toEqual([...CYBER_DIGITAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS]);
      expect(narratives[0]).toMatch(/formal cybersecurity framework/i);
      expect(narratives[0]).toMatch(/password managers/i);
      expect(narratives[0]).toMatch(/Digital Executive Protection/i);
      expect(narratives[0]).toMatch(/incident response plan/i);
    });

    it("does not return cyber narratives when risk is low", () => {
      const { answers, visibleIds, questions } = buildAllNoVisiblePillarAnswers("cyber-digital");
      const score = scorePillar("cyber-digital", answers, visibleIds, questions);

      const narratives = pillarNarrativeRecommendations("cyber-digital", {
        ...score,
        riskLevel: "low",
      }, answers, questions);

      expect(narratives).toEqual([]);
    });
  });

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
