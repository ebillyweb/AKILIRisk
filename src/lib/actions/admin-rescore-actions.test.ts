import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * C2 (BRD §7.2) tests for the rescore actions.
 *
 * Mocks: prisma, the recommendation engine, requireAdminRole, writeAudit,
 * next/cache.revalidatePath. The action's pillar-config dispatch dynamically
 * loads governance/identity-risk modules; we mock those too to keep the
 * test pure-in-memory.
 *
 * Round-11 commit 2.5b: AssessmentResponse.answer is now ciphertext at
 * rest. Fixture rows below carry encryptAnswer(value) as the column
 * value so the rescore action's decryptAnswer call succeeds (it would
 * throw on a literal numeric / object payload).
 */

const { prismaSpies, writeAuditSpy, requireAdminRoleSpy, scoringSpies, engineCtorSpy, recommendationEngineMatchSpy, getActiveThresholdsSpy } = vi.hoisted(() => {
  const upsertResult = { id: "ps-1" };
  const prismaSpies = {
    assessment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    assessmentResponse: { findMany: vi.fn() },
    intakeApproval: { findUnique: vi.fn() },
    pillarScore: { upsert: vi.fn().mockResolvedValue(upsertResult) },
    assessmentRecommendation: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    clientAdvisorAssignment: { findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  const writeAuditSpy = vi.fn().mockResolvedValue(undefined);
  const requireAdminRoleSpy = vi.fn().mockResolvedValue({
    userId: "admin-user-1",
    email: "admin@example.com",
    role: "ADMIN",
  });
  const scoringSpies = {
    calculatePillarScore: vi.fn(),
    calculateIdentityRiskScore: vi.fn(),
    getVisibleQuestions: vi.fn(),
  };
  const recommendationEngineMatchSpy = vi.fn().mockResolvedValue([]);
  // Fake constructor — `new RecommendationEngine()` needs a callable that
  // works with `new`. `class` mocks more reliably than vi.fn(() => obj).
  class FakeRecommendationEngine {
    matchAndDedupeRecommendations = recommendationEngineMatchSpy;
  }
  const engineCtorSpy = FakeRecommendationEngine;
  const getActiveThresholdsSpy = vi.fn().mockResolvedValue({ lowMin: 80, mediumMin: 60, highMin: 40 });
  return { prismaSpies, writeAuditSpy, requireAdminRoleSpy, scoringSpies, engineCtorSpy, recommendationEngineMatchSpy, getActiveThresholdsSpy };
});

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));
vi.mock("@/lib/audit/audit-log", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit/audit-log")>("@/lib/audit/audit-log");
  return { ...actual, writeAudit: (...args: unknown[]) => writeAuditSpy(...args) };
});
vi.mock("@/lib/admin/auth", () => ({ requireAdminRole: () => requireAdminRoleSpy() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/assessment/scoring", () => ({
  calculatePillarScore: (...args: unknown[]) => scoringSpies.calculatePillarScore(...args),
  calculateCustomizedPillarScore: vi.fn(),
}));
vi.mock("@/lib/assessment/branching", () => ({
  getVisibleQuestions: (...args: unknown[]) => scoringSpies.getVisibleQuestions(...args),
}));
vi.mock("@/lib/assessment/family-governance-pillar", () => ({
  familyGovernancePillar: { id: "family-governance" },
}));
vi.mock("@/lib/assessment/bank/load-bank", () => ({
  loadGovernanceQuestionsMerged: vi.fn().mockResolvedValue([{ id: "q1" }, { id: "q2" }]),
}));
vi.mock("@/lib/identity-risk/questions", () => ({
  identityRiskPillar: { id: "identity-risk" },
  identityRiskQuestions: [{ id: "iq1" }],
}));
vi.mock("@/lib/identity-risk/scoring", () => ({
  calculateIdentityRiskScore: (...args: unknown[]) => scoringSpies.calculateIdentityRiskScore(...args),
}));
vi.mock("@/lib/assessment/risk-thresholds", () => ({
  getActiveRiskThresholds: () => getActiveThresholdsSpy(),
}));
vi.mock("@/lib/assessment/engines/recommendation-engine", () => ({
  RecommendationEngine: engineCtorSpy,
}));

import {
  rescoreAssessment,
  rescoreAssessmentsBulk,
} from "./admin-rescore-actions";
import { AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import { encryptAnswer } from "@/lib/data/response-content";

beforeEach(() => {
  // Round-11 commit 2.5b: pin a deterministic ENCRYPTION_KEY so the
  // encryptAnswer / decryptAnswer round-trip in the rescore action's
  // query layer succeeds against fixture rows.
  process.env.ENCRYPTION_KEY = "test-key-do-not-use-in-prod-0123456789ABCDEF";
  // Reset all mocks
  for (const m of Object.values(prismaSpies)) {
    if (typeof m === "object") {
      for (const fn of Object.values(m as Record<string, ReturnType<typeof vi.fn>>)) {
        if (typeof fn === "function" && "mockReset" in fn) (fn as ReturnType<typeof vi.fn>).mockReset();
      }
    }
  }
  prismaSpies.$transaction.mockReset();
  writeAuditSpy.mockClear();
  requireAdminRoleSpy.mockClear();
  requireAdminRoleSpy.mockResolvedValue({
    userId: "admin-user-1",
    email: "admin@example.com",
    role: "ADMIN",
  });
  scoringSpies.calculatePillarScore.mockReset();
  scoringSpies.calculateIdentityRiskScore.mockReset();
  scoringSpies.getVisibleQuestions.mockReset();
  scoringSpies.getVisibleQuestions.mockReturnValue([{ id: "q1" }, { id: "q2" }]);
  recommendationEngineMatchSpy.mockReset();
  recommendationEngineMatchSpy.mockResolvedValue([]);
  getActiveThresholdsSpy.mockClear();
  getActiveThresholdsSpy.mockResolvedValue({ lowMin: 80, mediumMin: 60, highMin: 40 });

  // Default $transaction passthrough — runs the callback with a fake tx
  // that proxies to the same prisma mocks.
  prismaSpies.$transaction.mockImplementation(async (fn: (tx: typeof prismaSpies) => Promise<unknown>) => {
    return fn(prismaSpies);
  });
});

const VALID_ASSESSMENT_ID = "ckabcdefghij1234567890klmn";

function fakeAssessment(overrides: Partial<{ scores: unknown[]; recommendations: unknown[]; version: number }> = {}) {
  return {
    id: VALID_ASSESSMENT_ID,
    userId: "u-1",
    version: 1,
    approvalId: null,
    scores: [
      { pillar: "family-governance", score: 65, riskLevel: "MEDIUM", calculatedAt: new Date() },
    ],
    recommendations: [
      { id: "ar-old", serviceRecommendationId: "svc-old", priority: 1 },
    ],
    ...overrides,
  };
}

describe("rescoreAssessment", () => {
  it("returns failure for an unknown assessment", async () => {
    prismaSpies.assessment.findUnique.mockResolvedValue(null);
    const r = await rescoreAssessment({ assessmentId: VALID_ASSESSMENT_ID });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/not found/i);
  });

  it("returns failure when the assessment has no existing pillar scores", async () => {
    prismaSpies.assessment.findUnique.mockResolvedValue({
      ...fakeAssessment(),
      scores: [],
    });
    const r = await rescoreAssessment({ assessmentId: VALID_ASSESSMENT_ID });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/no existing pillar scores/i);
  });

  it("re-runs scoring + persists + bumps version + audits with before/after on success", async () => {
    prismaSpies.assessment.findUnique
      .mockResolvedValueOnce(fakeAssessment())
      .mockResolvedValueOnce({
        scores: [
          { pillar: "family-governance", score: 80, riskLevel: "LOW", calculatedAt: new Date() },
        ],
        recommendations: [],
      });
    prismaSpies.assessmentResponse.findMany.mockResolvedValue([
      { questionId: "q1", answer: encryptAnswer(3), pillar: "family-governance" },
    ]);
    scoringSpies.calculatePillarScore.mockReturnValue({
      score: 80,
      riskLevel: "low",
      breakdown: [],
      missingControls: [],
    });

    const r = await rescoreAssessment({
      assessmentId: VALID_ASSESSMENT_ID,
      reason: "After May threshold change",
    });

    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.newVersion).toBe(2);
      expect(r.data.pillarsChanged).toBe(1);
    }

    // PillarScore upserted
    expect(prismaSpies.pillarScore.upsert).toHaveBeenCalledTimes(1);
    // AssessmentRecommendation deleted
    expect(prismaSpies.assessmentRecommendation.deleteMany).toHaveBeenCalledTimes(1);
    // Assessment.version bumped + lastRescoredAt set
    expect(prismaSpies.assessment.update).toHaveBeenCalledTimes(1);
    const updateCall = prismaSpies.assessment.update.mock.calls[0][0];
    expect(updateCall.where.id).toBe(VALID_ASSESSMENT_ID);
    expect(updateCall.data.version).toBe(2);
    expect(updateCall.data.lastRescoredAt).toBeInstanceOf(Date);

    // Audit row written with before/after + reason
    expect(writeAuditSpy).toHaveBeenCalledTimes(1);
    const auditCall = writeAuditSpy.mock.calls[0][0];
    expect(auditCall.action).toBe(AUDIT_ACTIONS.ASSESSMENT_RESCORE);
    expect(auditCall.entityType).toBe("Assessment");
    expect(auditCall.entityId).toBe(VALID_ASSESSMENT_ID);
    expect(auditCall.beforeData).toMatchObject({ pillarScores: expect.any(Array), recommendations: expect.any(Array) });
    expect(auditCall.afterData).toMatchObject({ pillarScores: expect.any(Array), recommendations: expect.any(Array) });
    expect(auditCall.metadata).toMatchObject({
      reason: "After May threshold change",
      succeeded: true,
    });
  });

  it("rolls back the entire rescore if the transaction throws + audit row marks succeeded:false", async () => {
    prismaSpies.assessment.findUnique.mockResolvedValue(fakeAssessment());
    prismaSpies.assessmentResponse.findMany.mockResolvedValue([]);
    scoringSpies.calculatePillarScore.mockReturnValue({
      score: 80,
      riskLevel: "low",
      breakdown: [],
      missingControls: [],
    });
    prismaSpies.$transaction.mockRejectedValueOnce(new Error("constraint violation"));

    const r = await rescoreAssessment({ assessmentId: VALID_ASSESSMENT_ID });
    expect(r.success).toBe(false);

    // Audit row still written despite rollback (the finally branch).
    expect(writeAuditSpy).toHaveBeenCalledTimes(1);
    const auditCall = writeAuditSpy.mock.calls[0][0];
    expect(auditCall.action).toBe(AUDIT_ACTIONS.ASSESSMENT_RESCORE);
    expect(auditCall.metadata.succeeded).toBe(false);
    // beforeData captured pre-transaction; afterData null because the
    // post-write read never happened.
    expect(auditCall.beforeData).not.toBeNull();
    expect(auditCall.afterData).toBeNull();
  });

  it("invokes RecommendationEngine.matchAndDedupeRecommendations with the new pillar scores", async () => {
    prismaSpies.assessment.findUnique
      .mockResolvedValueOnce(fakeAssessment())
      .mockResolvedValueOnce({ scores: [], recommendations: [] });
    prismaSpies.assessmentResponse.findMany.mockResolvedValue([]);
    scoringSpies.calculatePillarScore.mockReturnValue({
      score: 35,
      riskLevel: "high",
      breakdown: [],
      missingControls: [],
    });
    recommendationEngineMatchSpy.mockResolvedValue([
      { id: "svc-new", name: "New svc", description: "x", category: "test", priority: 5, triggerReason: ["score < 40"] },
    ]);

    const r = await rescoreAssessment({ assessmentId: VALID_ASSESSMENT_ID });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.recommendationsCount).toBe(1);

    expect(recommendationEngineMatchSpy).toHaveBeenCalledTimes(1);
    const ctx = recommendationEngineMatchSpy.mock.calls[0][0];
    expect(ctx.assessmentId).toBe(VALID_ASSESSMENT_ID);
    expect(ctx.pillarScores["family-governance"]).toMatchObject({
      score: 35,
      riskLevel: "high",
    });
  });
});

describe("rescoreAssessmentsBulk", () => {
  beforeEach(() => {
    // Default: scoring succeeds for any candidate.
    prismaSpies.assessment.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(fakeAssessment({ }))
    );
    prismaSpies.assessmentResponse.findMany.mockResolvedValue([]);
    scoringSpies.calculatePillarScore.mockReturnValue({
      score: 80,
      riskLevel: "low",
      breakdown: [],
      missingControls: [],
    });
  });

  it("returns 0/0/0 when no assessments match the filter", async () => {
    prismaSpies.assessment.findMany.mockResolvedValue([]);

    const r = await rescoreAssessmentsBulk({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.attempted).toBe(0);
      expect(r.data.successCount).toBe(0);
      expect(r.data.failureCount).toBe(0);
    }
  });

  it("scopes to advisor.clients via ClientAdvisorAssignment when advisorProfileId is set", async () => {
    prismaSpies.clientAdvisorAssignment.findMany.mockResolvedValue([
      { clientId: "c-1" },
      { clientId: "c-2" },
    ]);
    // Bulk feeds candidate ids straight into rescoreAssessment, which
    // Zod-validates as cuid. Use real cuid-shaped strings.
    const CUID_AS_1 = "ckaaaaaaaaaaaaaaaaaaaaaaaaa";
    prismaSpies.assessment.findMany.mockResolvedValue([{ id: CUID_AS_1 }]);

    // Make the inner rescoreAssessment chain succeed
    let findUniqueCallCount = 0;
    prismaSpies.assessment.findUnique.mockImplementation(() => {
      findUniqueCallCount++;
      if (findUniqueCallCount === 1) {
        return Promise.resolve(fakeAssessment());
      }
      return Promise.resolve({ scores: [], recommendations: [] });
    });

    const r = await rescoreAssessmentsBulk({
      advisorProfileId: "ckabcdefghij1234567890advis",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.attempted).toBe(1);
      expect(r.data.successCount).toBe(1);
    }

    // assessment.findMany was called with userId: { in: [c-1, c-2] }
    const findManyCall = prismaSpies.assessment.findMany.mock.calls[0][0];
    expect(findManyCall.where.userId.in.sort()).toEqual(["c-1", "c-2"]);
  });

  it("collects per-row failures into the failures[] array (sequential semantics)", async () => {
    const CUID_GOOD_1 = "ckaaaaaaaaaaaaaaaaaaaaaa001";
    const CUID_BAD = "ckbbbbbbbbbbbbbbbbbbbbbb002";
    const CUID_GOOD_2 = "ckcccccccccccccccccccccc003";
    prismaSpies.assessment.findMany.mockResolvedValue([
      { id: CUID_GOOD_1 },
      { id: CUID_BAD },
      { id: CUID_GOOD_2 },
    ]);
    // Per-id state. Each rescoreAssessment makes TWO findUnique calls
    // for the success case (snapshot pre-tx + read-back post-tx) and ONE
    // for the no-scores fast-fail.
    const callsPerId: Record<string, number> = { [CUID_GOOD_1]: 0, [CUID_BAD]: 0, [CUID_GOOD_2]: 0 };
    prismaSpies.assessment.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      callsPerId[where.id] = (callsPerId[where.id] ?? 0) + 1;
      if (where.id === CUID_BAD) {
        // First (and only) call: return assessment with empty scores → fails.
        return Promise.resolve({ ...fakeAssessment(), scores: [] });
      }
      // Good cases: first call returns full assessment, subsequent
      // (read-back) returns the post-state.
      if (callsPerId[where.id] === 1) {
        return Promise.resolve(fakeAssessment());
      }
      return Promise.resolve({ scores: [], recommendations: [] });
    });

    const r = await rescoreAssessmentsBulk({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.attempted).toBe(3);
      expect(r.data.successCount).toBe(2);
      expect(r.data.failureCount).toBe(1);
      expect(r.data.failures[0].assessmentId).toBe(CUID_BAD);
      expect(r.data.failures[0].error).toMatch(/no existing pillar scores/i);
    }
  });

  it("respects the maxAssessments cap (default 100)", async () => {
    prismaSpies.assessment.findMany.mockResolvedValue([]);

    await rescoreAssessmentsBulk({});

    const findManyCall = prismaSpies.assessment.findMany.mock.calls[0][0];
    expect(findManyCall.take).toBe(100);
  });

  it("respects an explicit maxAssessments override", async () => {
    prismaSpies.assessment.findMany.mockResolvedValue([]);

    await rescoreAssessmentsBulk({ maxAssessments: 25 });

    const findManyCall = prismaSpies.assessment.findMany.mock.calls[0][0];
    expect(findManyCall.take).toBe(25);
  });
});
