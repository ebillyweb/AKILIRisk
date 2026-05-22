import { describe, it, expect, vi, beforeEach } from "vitest";
import { RecommendationEngine } from "./recommendation-engine";
import {
  FAMILY_GOVERNANCE_ALL_NO_EXPECTED_SERVICE_IDS,
  HIGH_RISK_FAMILY_ANSWERS,
  HIGH_RISK_PILLAR_SCORES,
  HIGH_RISK_EXPECTED_SERVICE_IDS,
  GOVERNANCE_REMEDIATION_SERVICE_IDS,
  LOW_RISK_FAMILY_ANSWERS,
  PRODUCTION_CATALOG_RULES,
  PRODUCTION_CATALOG_SERVICES_WITH_CYBER,
} from "./recommendation-catalog-fixtures";
import {
  buildAllNoVisibleFamilyAnswers,
  scoreFamilyGovernancePillar,
  toPrismaCatalogMocks,
} from "./recommendation-test-helpers";

const { rules, services } = toPrismaCatalogMocks(
  PRODUCTION_CATALOG_SERVICES_WITH_CYBER,
  PRODUCTION_CATALOG_RULES
);

const findManySpy = vi.fn();
const findUniqueSpy = vi.fn();
const createManySpy = vi.fn().mockResolvedValue({ count: 0 });

vi.mock("@/lib/db", () => ({
  prisma: {
    recommendationRule: {
      findMany: (...args: unknown[]) => findManySpy(...args),
    },
    serviceRecommendation: {
      findUnique: (...args: unknown[]) => findUniqueSpy(...args),
    },
    assessmentRecommendation: {
      createMany: (...args: unknown[]) => createManySpy(...args),
    },
  },
}));

beforeEach(() => {
  findManySpy.mockReset();
  findUniqueSpy.mockReset();
  createManySpy.mockClear();

  findManySpy.mockResolvedValue(rules);
  findUniqueSpy.mockImplementation(({ where }: { where: { id: string } }) => {
    return Promise.resolve(services.find((s) => s.id === where.id) ?? null);
  });
});

describe("RecommendationEngine — happy paths (production catalog)", () => {
  it("high-risk family answers trigger all seeded remediation services", async () => {
    const engine = new RecommendationEngine();
    const recs = await engine.matchAndDedupeRecommendations({
      assessmentId: "as-happy-high",
      userId: "u-1",
      pillarScores: HIGH_RISK_PILLAR_SCORES,
      answers: HIGH_RISK_FAMILY_ANSWERS,
      householdProfile: { householdSize: 5 },
      missingControls: [],
    });

    const ids = recs.map((r) => r.id).sort();
    expect(ids).toEqual([...HIGH_RISK_EXPECTED_SERVICE_IDS].sort());
    expect(recs.length).toBe(HIGH_RISK_EXPECTED_SERVICE_IDS.length);
  });

  it("high-risk governance answers alone trigger charter, advisor, and succession services", async () => {
    const engine = new RecommendationEngine();
    const recs = await engine.matchAndDedupeRecommendations({
      assessmentId: "as-happy-gov",
      userId: "u-2",
      pillarScores: { governance: HIGH_RISK_PILLAR_SCORES.governance },
      answers: {
        governance_family_charter: "none",
        governance_advisor_coordination: "siloed",
        governance_next_gen_engagement: "no_preparation",
      },
      householdProfile: null,
      missingControls: [],
    });

    const ids = recs.map((r) => r.id).sort();
    expect(ids).toEqual([...GOVERNANCE_REMEDIATION_SERVICE_IDS].sort());
  });

  it("low-risk family answers do not trigger governance remediation services", async () => {
    const engine = new RecommendationEngine();
    const recs = await engine.matchAndDedupeRecommendations({
      assessmentId: "as-happy-low",
      userId: "u-3",
      pillarScores: {
        governance: { score: 2.8, riskLevel: "low" },
        "physical-security": { score: 2.9, riskLevel: "low" },
        insurance: { score: 2.9, riskLevel: "low" },
        "geographic-environmental": { score: 2.8, riskLevel: "low" },
        "reputational-social": { score: 2.9, riskLevel: "low" },
      },
      answers: LOW_RISK_FAMILY_ANSWERS,
      householdProfile: { householdSize: 6 },
      missingControls: [],
    });

    for (const id of GOVERNANCE_REMEDIATION_SERVICE_IDS) {
      expect(recs.map((r) => r.id)).not.toContain(id);
    }
    expect(recs.length).toBe(0);
  });

  it("records trigger reasons for matched governance charter rule", async () => {
    const engine = new RecommendationEngine();
    const recs = await engine.matchAndDedupeRecommendations({
      assessmentId: "as-happy-reasons",
      userId: "u-4",
      pillarScores: { governance: HIGH_RISK_PILLAR_SCORES.governance },
      answers: { governance_family_charter: "none" },
      householdProfile: null,
      missingControls: [],
    });

    const charter = recs.find((r) => r.id === "governance_family_charter");
    expect(charter).toBeDefined();
    expect(charter!.triggerReason.some((r) => r.includes("governance_family_charter"))).toBe(
      true
    );
  });
});

describe("RecommendationEngine — family-governance question bank (all no)", () => {
  it("answering no on every visible yes-no yields critical risk and missing controls", () => {
    const { answers, visibleIds } = buildAllNoVisibleFamilyAnswers();
    const score = scoreFamilyGovernancePillar(answers, visibleIds);

    expect(score.riskLevel).toBe("critical");
    expect(score.score).toBeLessThan(1.2);
    expect(score.missingControls.length).toBeGreaterThan(0);

    const yesNoIds = visibleIds.filter((id) => {
      const q = answers[id];
      return q === "no";
    });
    expect(yesNoIds.length).toBeGreaterThan(0);
  });

  it("all-no visible answers trigger the full UI catalog remediation set", async () => {
    const { answers, visibleIds } = buildAllNoVisibleFamilyAnswers();
    const score = scoreFamilyGovernancePillar(answers, visibleIds);

    const engine = new RecommendationEngine();
    const recs = await engine.matchAndDedupeRecommendations({
      assessmentId: "as-all-no-ui",
      userId: "u-5",
      pillarScores: {
        "family-governance": { score: score.score, riskLevel: score.riskLevel },
      },
      answers,
      householdProfile: null,
      missingControls: score.missingControls,
    });

    const ids = recs.map((r) => r.id).sort();
    expect(ids).toEqual([...FAMILY_GOVERNANCE_ALL_NO_EXPECTED_SERVICE_IDS].sort());
    expect(score.riskLevel).toBe("critical");
  });
});
