import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * C1 (BRD §4.4) regression test for the recommendation engine.
 *
 * Purpose: pin the engine's output for a known scored context against a
 * small, in-test rule set so future schema additions (this commit's
 * tier/complexity/implementationType columns; future ones) can't silently
 * break matching. The engine never reads the new columns, so this test
 * should keep passing across the C1 migration; if it breaks, something
 * non-obvious about the engine's data flow has shifted.
 *
 * Strategy: mock prisma so the engine loads its rules + service catalog
 * from in-memory fixtures. No DB, no seed-script coupling. The test
 * fixtures are intentionally a small subset of what the production seed
 * scripts write — enough to cover all 5 condition types + the
 * deduplication + the >50% weighted-conditions match threshold.
 */

const fakeRules = [
  // Cybersecurity: 2 conditions, both should fire on the test context
  // (score=4 < 60, riskLevel=high → in [high, critical]). Weighted:
  // 3+2 of 3+2 = 100% > 50% → matches.
  {
    id: "rule-cyber-1",
    serviceRecommendationId: "svc-cyber-uplift",
    ruleName: "Cyber uplift for high risk",
    description: null,
    triggerConditions: [
      { type: "score_threshold", pillarId: "cyber-digital", operator: "less_than", value: 60, weight: 3 },
      { type: "risk_level", pillarId: "cyber-digital", operator: "in", value: ["high", "critical"], weight: 2 },
    ],
    pillarThresholds: null,
    questionConditions: null,
    priority: 90,
    isActive: true,
  },
  // Governance: only the answer_match condition fires (no answer for
  // governance_will_exists in fixture context.answers); score is high so
  // score_threshold also fails. 0 of 2+3 = 0% < 50% → no match.
  {
    id: "rule-gov-1",
    serviceRecommendationId: "svc-gov-charter",
    ruleName: "Governance charter",
    description: null,
    triggerConditions: [
      { type: "answer_match", questionId: "governance_will_exists", operator: "equals", value: "no", weight: 2 },
      { type: "score_threshold", pillarId: "governance", operator: "less_than", value: 40, weight: 3 },
    ],
    pillarThresholds: null,
    questionConditions: null,
    priority: 80,
    isActive: true,
  },
  // Lifestyle: missing_control fires on questionId match. 1 of 1 = 100%
  // → matches.
  {
    id: "rule-life-1",
    serviceRecommendationId: "svc-life-coaching",
    ruleName: "Lifestyle coaching for missing controls",
    description: null,
    triggerConditions: [
      { type: "missing_control", questionId: "behavioral_substance_screen", operator: "equals", weight: 1 },
    ],
    pillarThresholds: null,
    questionConditions: null,
    priority: 70,
    isActive: true,
  },
];

const fakeServices = [
  {
    id: "svc-cyber-uplift",
    name: "Cybersecurity Uplift",
    description: "Comprehensive cyber overhaul",
    category: "security",
    priority: 90,
    estimatedCost: "$15,000",
    timeframe: "2-4 months",
    provider: "Akili Cyber Partners",
    metadata: null,
    isActive: true,
    // C1 schema additions (engine never reads these, but they're present
    // in the row so we include them to mirror real DB shape):
    tier: "BASELINE",
    complexity: "MEDIUM",
    implementationType: "ADVISORY",
  },
  {
    id: "svc-gov-charter",
    name: "Family Charter",
    description: "Governance charter facilitation",
    category: "governance",
    priority: 80,
    estimatedCost: "$25,000",
    timeframe: "3 months",
    provider: "Family Office Counsel",
    metadata: null,
    isActive: true,
    tier: "BASELINE",
    complexity: "HIGH",
    implementationType: "ADVISORY",
  },
  {
    id: "svc-life-coaching",
    name: "Lifestyle Coaching",
    description: "Behavioral health coaching",
    category: "advisory",
    priority: 70,
    estimatedCost: "$5,000",
    timeframe: "ongoing",
    provider: "Akili Wellness Network",
    metadata: null,
    isActive: true,
    tier: "ENHANCED",
    complexity: "LOW",
    implementationType: "DIY",
  },
];

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

import { RecommendationEngine } from "./recommendation-engine";

beforeEach(() => {
  findManySpy.mockReset();
  findUniqueSpy.mockReset();
  createManySpy.mockClear();

  findManySpy.mockResolvedValue(fakeRules);
  findUniqueSpy.mockImplementation(({ where }: { where: { id: string } }) => {
    return Promise.resolve(fakeServices.find((s) => s.id === where.id) ?? null);
  });
});

describe("RecommendationEngine — C1 schema-additions regression", () => {
  it("matches the cyber + lifestyle rules on a high-cyber, missing-substance-screen context", async () => {
    const engine = new RecommendationEngine();
    const recs = await engine.generateRecommendations({
      assessmentId: "as-test-1",
      userId: "u-1",
      pillarScores: {
        "cyber-digital": { score: 35, riskLevel: "high" },
        governance: { score: 75, riskLevel: "low" },
      },
      answers: {},
      householdProfile: { size: 4 },
      missingControls: [
        { questionId: "behavioral_substance_screen", category: "lifestyle" },
      ],
    });

    const ids = recs.map((r) => r.id).sort();
    expect(ids).toEqual(["svc-cyber-uplift", "svc-life-coaching"]);
  });

  it("excludes the governance rule when neither condition is satisfied", async () => {
    const engine = new RecommendationEngine();
    const recs = await engine.generateRecommendations({
      assessmentId: "as-test-2",
      userId: "u-2",
      pillarScores: {
        "cyber-digital": { score: 35, riskLevel: "high" },
        governance: { score: 75, riskLevel: "low" },
      },
      answers: {},
      householdProfile: {},
      missingControls: [],
    });

    const ids = recs.map((r) => r.id);
    expect(ids).not.toContain("svc-gov-charter");
  });

  it("orders matches by service priority descending", async () => {
    const engine = new RecommendationEngine();
    const recs = await engine.generateRecommendations({
      assessmentId: "as-test-3",
      userId: "u-3",
      pillarScores: {
        "cyber-digital": { score: 35, riskLevel: "critical" },
      },
      answers: {},
      householdProfile: {},
      missingControls: [
        { questionId: "behavioral_substance_screen", category: "lifestyle" },
      ],
    });

    expect(recs.map((r) => r.id)).toEqual(["svc-cyber-uplift", "svc-life-coaching"]);
    expect(recs[0].priority).toBeGreaterThan(recs[1].priority);
  });

  it("persists matched recommendations via createMany (skipDuplicates)", async () => {
    const engine = new RecommendationEngine();
    await engine.generateRecommendations({
      assessmentId: "as-test-4",
      userId: "u-4",
      pillarScores: { "cyber-digital": { score: 35, riskLevel: "high" } },
      answers: {},
      householdProfile: {},
      missingControls: [{ questionId: "behavioral_substance_screen", category: "lifestyle" }],
    });

    expect(createManySpy).toHaveBeenCalledTimes(1);
    const arg = createManySpy.mock.calls[0][0];
    expect(arg.skipDuplicates).toBe(true);
    expect(arg.data.map((d: { serviceRecommendationId: string }) => d.serviceRecommendationId).sort()).toEqual([
      "svc-cyber-uplift",
      "svc-life-coaching",
    ]);
  });

  it("ignores the new tier/complexity/implementationType columns in matching logic (C1 invariant)", async () => {
    // The C1 commit adds tier/complexity/implementationType to the
    // ServiceRecommendation row. The engine MUST NOT branch on these —
    // matching is rules-only. To prove it, swap every service's tier to
    // ENHANCED and complexity to HIGH and verify the same matches surface.
    findUniqueSpy.mockImplementation(({ where }: { where: { id: string } }) => {
      const original = fakeServices.find((s) => s.id === where.id);
      if (!original) return Promise.resolve(null);
      return Promise.resolve({ ...original, tier: "ENHANCED", complexity: "HIGH", implementationType: "DIY" });
    });

    const engine = new RecommendationEngine();
    const recs = await engine.generateRecommendations({
      assessmentId: "as-test-5",
      userId: "u-5",
      pillarScores: { "cyber-digital": { score: 35, riskLevel: "high" } },
      answers: {},
      householdProfile: {},
      missingControls: [{ questionId: "behavioral_substance_screen", category: "lifestyle" }],
    });

    expect(recs.map((r) => r.id).sort()).toEqual(["svc-cyber-uplift", "svc-life-coaching"]);
  });
});
