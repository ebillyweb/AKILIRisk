import { describe, it, expect, vi, beforeEach } from "vitest";
import { RecommendationEngine, type RecommendationRule } from "./recommendation-engine";
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
import { ASSESSMENT_PILLAR_IDS } from "@/lib/assessment/pillar-registry";
import {
  buildAllNoVisibleFamilyAnswers,
  questionsForPillar,
  scorePillar,
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
      findFirst: (...args: unknown[]) => findUniqueSpy(...args),
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
        "liquidity-cash": { score: 2.8, riskLevel: "low" },
        "tax-exposure": { score: 2.9, riskLevel: "low" },
        "estate-succession": { score: 2.8, riskLevel: "low" },
        "family-governance-behavioral": { score: 2.9, riskLevel: "low" },
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

describe("RecommendationEngine — new pillar high-risk triggering", () => {
  it("liquidity-cash high-risk answers trigger liquidity services", async () => {
    const engine = new RecommendationEngine();
    const recs = await engine.matchAndDedupeRecommendations({
      assessmentId: "as-liq-high",
      userId: "u-liq",
      pillarScores: { "liquidity-cash": { score: 0.5, riskLevel: "critical" } },
      answers: {
        liquidity_cash_reserves: "none",
        liquidity_credit_facilities: "none",
        liquidity_concentration: "concentrated",
      },
      householdProfile: null,
      missingControls: [],
    });
    const ids = recs.map((r) => r.id);
    expect(ids).toContain("liquidity_cash_reserve_planning");
  });

  it("tax-exposure high-risk answers trigger tax services", async () => {
    const engine = new RecommendationEngine();
    const recs = await engine.matchAndDedupeRecommendations({
      assessmentId: "as-tax-high",
      userId: "u-tax",
      pillarScores: { "tax-exposure": { score: 0.6, riskLevel: "critical" } },
      answers: {
        tax_residency_posture: "none",
        tax_event_modeling: "none",
        tax_estate_mapping: "none",
      },
      householdProfile: null,
      missingControls: [],
    });
    const ids = recs.map((r) => r.id);
    expect(ids).toContain("tax_residency_review");
  });

  it("estate-succession high-risk answers trigger estate services", async () => {
    const engine = new RecommendationEngine();
    const recs = await engine.matchAndDedupeRecommendations({
      assessmentId: "as-est-high",
      userId: "u-est",
      pillarScores: { "estate-succession": { score: 0.5, riskLevel: "critical" } },
      answers: {
        estate_document_currency: "none_outdated",
        estate_beneficiary_alignment: "none",
        estate_succession_protocol: "none",
      },
      householdProfile: null,
      missingControls: [],
    });
    const ids = recs.map((r) => r.id);
    expect(ids).toContain("estate_document_review");
  });

  it("low AI & Emerging Tech Risk pillar score triggers AI remediation services", async () => {
    const engine = new RecommendationEngine();
    // The AI pillar keeps the legacy slug `family-governance-behavioral`. Its
    // rules are score-threshold-only, so a low pillar score alone triggers the
    // tiered AI remediation services (no answer-level match required).
    const recs = await engine.matchAndDedupeRecommendations({
      assessmentId: "as-ai-high",
      userId: "u-ai",
      pillarScores: { "family-governance-behavioral": { score: 0.7, riskLevel: "critical" } },
      answers: {},
      householdProfile: null,
      missingControls: [],
    });
    const ids = recs.map((r) => r.id);
    expect(ids).toContain("ai_impersonation_defense");
    expect(ids).toContain("ai_data_governance");
    expect(ids).toContain("ai_synthetic_media_response");
  });

  it("advisor rulesOverride restricts recommendations to overridden ruleset", async () => {
    const engine = new RecommendationEngine();
    // Filter to governance-only rules, then map CatalogRule -> RecommendationRule shape
    const governanceOnlyRules: RecommendationRule[] = PRODUCTION_CATALOG_RULES
      .filter((r) => r.serviceRecommendationId.startsWith("governance_"))
      .map((r) => ({
        id: r.id,
        serviceId: r.serviceRecommendationId,   // CatalogRule field -> engine field
        conditions: r.triggerConditions,          // CatalogRule field -> engine field
        priority: r.priority,
      }));
    // Feed high-risk answers and scores for ALL pillars, but override rules to governance-only
    const recs = await engine.matchAndDedupeRecommendations(
      {
        assessmentId: "as-override",
        userId: "u-override",
        pillarScores: HIGH_RISK_PILLAR_SCORES,
        answers: HIGH_RISK_FAMILY_ANSWERS,
        householdProfile: null,
        missingControls: [],
      },
      governanceOnlyRules,
    );
    const ids = recs.map((r) => r.id);
    // Only governance services should appear despite all pillars being high-risk
    expect(ids.sort()).toEqual([...GOVERNANCE_REMEDIATION_SERVICE_IDS].sort());
    // No non-governance services should leak through
    expect(ids.every((id) => id.startsWith("governance_"))).toBe(true);
  });
});

describe("RecommendationEngine — Belvedere bank (all no)", () => {
  it("answering no on every visible yes-no yields critical risk and missing controls", () => {
    const { answers, visibleIds } = buildAllNoVisibleFamilyAnswers();
    const score = scorePillar("governance", answers, visibleIds, questionsForPillar("governance"));

    expect(score.riskLevel).toBe("critical");
    expect(score.score).toBeLessThan(1.2);
    expect(score.missingControls.length).toBeGreaterThan(0);

    const yesNoIds = visibleIds.filter((id) => answers[id] === "no");
    expect(yesNoIds.length).toBeGreaterThan(0);
  });

  it("all-no visible answers trigger the full Belvedere catalog remediation set", async () => {
    const { answers, visibleIds } = buildAllNoVisibleFamilyAnswers();

    const pillarScores: Record<string, { score: number; riskLevel: "critical" }> = {};
    const missingControls = [];
    for (const pillarId of ASSESSMENT_PILLAR_IDS) {
      const questions = questionsForPillar(pillarId);
      const pillarVisibleIds = visibleIds.filter((id) => questions.some((q) => q.id === id));
      const score = scorePillar(pillarId, answers, pillarVisibleIds, questions);
      pillarScores[pillarId] = { score: score.score, riskLevel: "critical" };
      missingControls.push(...score.missingControls);
    }

    const engine = new RecommendationEngine();
    const recs = await engine.matchAndDedupeRecommendations({
      assessmentId: "as-all-no-belvedere",
      userId: "u-5",
      pillarScores,
      answers,
      householdProfile: null,
      missingControls,
    });

    const ids = recs.map((r) => r.id).sort();
    expect(ids).toEqual([...FAMILY_GOVERNANCE_ALL_NO_EXPECTED_SERVICE_IDS].sort());
  });
});
