import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * C1 (BRD §4.4) action + schema tests.
 *
 * Two layers covered here:
 *   1. The Zod discriminated-union conditionSchema rejects bad shapes
 *      (wrong type, missing pillarId, wrong value type, contradictory
 *      threshold pair).
 *   2. The server actions write the right Prisma row + the right audit
 *      event for create / update / setActive / delete.
 *
 * Mocks: prisma + writeAudit + requireAdminRole. The actions never touch
 * a real DB in this test.
 */

// Spies + mock state hoisted via vi.hoisted so the vi.mock factories
// (themselves hoisted to top-of-file) can read them without the
// "Cannot access X before initialization" trap.
const { prismaSpies, writeAuditSpy, requireAdminRoleSpy } = vi.hoisted(() => ({
  prismaSpies: {
    serviceRecommendation: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    recommendationRule: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  writeAuditSpy: vi.fn().mockResolvedValue(undefined),
  requireAdminRoleSpy: vi
    .fn()
    .mockResolvedValue({ userId: "admin-user-1", email: "admin@example.com" }),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));
vi.mock("@/lib/audit/audit-log", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit/audit-log")>("@/lib/audit/audit-log");
  return {
    ...actual,
    writeAudit: (...args: unknown[]) => writeAuditSpy(...args),
  };
});
vi.mock("@/lib/admin/auth", () => ({
  requireAdminRole: () => requireAdminRoleSpy(),
}));
// next/cache#revalidatePath requires Next's static generation store, which
// doesn't exist in vitest. Stub it to a no-op so action calls don't
// invariant-throw on the post-write revalidate.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  conditionSchema,
  recommendationRuleInputSchema,
  serviceRecommendationInputSchema,
  detectContradictoryConditions,
  TIER_VALUES,
  COMPLEXITY_VALUES,
  IMPLEMENTATION_TYPE_VALUES,
} from "@/lib/admin/recommendation-rule-schemas";
import {
  createServiceRecommendation,
  updateServiceRecommendation,
  setServiceRecommendationActive,
  deleteServiceRecommendation,
  createRecommendationRule,
  setRecommendationRuleActive,
  reorderRecommendationRules,
} from "./admin-recommendation-actions";
import { AUDIT_ACTIONS } from "@/lib/audit/audit-log";

beforeEach(() => {
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
  requireAdminRoleSpy.mockResolvedValue({ userId: "admin-user-1", email: "admin@example.com" });
});

// ── Enum-mirror invariants ───────────────────────────────────────────────

describe("Enum mirrors match the migration SQL", () => {
  it("TIER_VALUES matches the migration's RecommendationTier enum", () => {
    expect([...TIER_VALUES]).toEqual(["BASELINE", "ENHANCED"]);
  });
  it("COMPLEXITY_VALUES matches RecommendationComplexity", () => {
    expect([...COMPLEXITY_VALUES]).toEqual(["LOW", "MEDIUM", "HIGH"]);
  });
  it("IMPLEMENTATION_TYPE_VALUES matches ImplementationType", () => {
    expect([...IMPLEMENTATION_TYPE_VALUES]).toEqual(["DIY", "ADVISORY", "HYBRID"]);
  });
});

// ── conditionSchema (discriminated union) ────────────────────────────────

describe("conditionSchema — score_threshold", () => {
  it("accepts a valid score_threshold condition", () => {
    const r = conditionSchema.safeParse({
      type: "score_threshold",
      pillarId: "cybersecurity",
      operator: "less_than",
      value: 60,
      weight: 3,
    });
    expect(r.success).toBe(true);
  });
  it("rejects score_threshold without pillarId", () => {
    const r = conditionSchema.safeParse({
      type: "score_threshold",
      operator: "less_than",
      value: 60,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      // The path identifies the failing field; the message text varies
      // based on whether the value was empty-string vs missing.
      expect(r.error.issues.some((i) => i.path.includes("pillarId"))).toBe(true);
    }
  });
  it("rejects score_threshold with non-numeric value", () => {
    const r = conditionSchema.safeParse({
      type: "score_threshold",
      pillarId: "cybersecurity",
      operator: "less_than",
      value: "low",
    });
    expect(r.success).toBe(false);
  });
  it("rejects score_threshold with operator='in' (not in the allowed set)", () => {
    const r = conditionSchema.safeParse({
      type: "score_threshold",
      pillarId: "cybersecurity",
      operator: "in",
      value: 60,
    });
    expect(r.success).toBe(false);
  });
});

describe("conditionSchema — risk_level", () => {
  it("accepts equals + single risk-level value", () => {
    const r = conditionSchema.safeParse({
      type: "risk_level",
      pillarId: "cybersecurity",
      operator: "equals",
      value: "high",
    });
    expect(r.success).toBe(true);
  });
  it("rejects risk_level with value: 123", () => {
    const r = conditionSchema.safeParse({
      type: "risk_level",
      pillarId: "cybersecurity",
      operator: "equals",
      value: 123,
    });
    expect(r.success).toBe(false);
  });
  it("accepts in[] with array of risk levels", () => {
    const r = conditionSchema.safeParse({
      type: "risk_level",
      pillarId: "cybersecurity",
      operator: "in",
      value: ["high", "critical"],
    });
    expect(r.success).toBe(true);
  });
  it("rejects equals when value is an array (operator/value mismatch)", () => {
    const r = conditionSchema.safeParse({
      type: "risk_level",
      pillarId: "cybersecurity",
      operator: "equals",
      value: ["high", "critical"],
    });
    expect(r.success).toBe(false);
  });
  it("rejects in with empty array", () => {
    const r = conditionSchema.safeParse({
      type: "risk_level",
      pillarId: "cybersecurity",
      operator: "in",
      value: [],
    });
    expect(r.success).toBe(false);
  });
});

describe("conditionSchema — answer_match", () => {
  it("accepts equals + scalar value", () => {
    const r = conditionSchema.safeParse({
      type: "answer_match",
      questionId: "q1",
      operator: "equals",
      value: "no",
    });
    expect(r.success).toBe(true);
  });
  it("accepts in[] with array of scalars", () => {
    const r = conditionSchema.safeParse({
      type: "answer_match",
      questionId: "q1",
      operator: "in",
      value: ["yes", "maybe"],
    });
    expect(r.success).toBe(true);
  });
  it("rejects answer_match without questionId", () => {
    const r = conditionSchema.safeParse({
      type: "answer_match",
      operator: "equals",
      value: "no",
    });
    expect(r.success).toBe(false);
  });
});

describe("conditionSchema — missing_control", () => {
  it("accepts the canonical shape", () => {
    const r = conditionSchema.safeParse({
      type: "missing_control",
      questionId: "q1",
      operator: "equals",
    });
    expect(r.success).toBe(true);
  });
  it("rejects without questionId", () => {
    const r = conditionSchema.safeParse({
      type: "missing_control",
      operator: "equals",
    });
    expect(r.success).toBe(false);
  });
});

describe("conditionSchema — profile_condition", () => {
  it("accepts a canonical shape with field path + scalar value", () => {
    const r = conditionSchema.safeParse({
      type: "profile_condition",
      field: "size",
      operator: "greater_than",
      value: 5,
    });
    expect(r.success).toBe(true);
  });
  it("rejects without field path", () => {
    const r = conditionSchema.safeParse({
      type: "profile_condition",
      operator: "greater_than",
      value: 5,
    });
    expect(r.success).toBe(false);
  });
});

// ── Cross-condition validation (contradictory pair) ──────────────────────

describe("detectContradictoryConditions", () => {
  it("flags > X AND < Y where Y <= X (impossible) on the same pillar", () => {
    const issues = detectContradictoryConditions([
      { type: "score_threshold", pillarId: "cybersecurity", operator: "greater_than", value: 80, weight: 1 },
      { type: "score_threshold", pillarId: "cybersecurity", operator: "less_than", value: 60, weight: 1 },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0].conditionIndices.sort()).toEqual([0, 1]);
    expect(issues[0].message).toMatch(/cybersecurity/);
  });
  it("does NOT flag > X AND < Y where Y > X (possible)", () => {
    const issues = detectContradictoryConditions([
      { type: "score_threshold", pillarId: "cybersecurity", operator: "greater_than", value: 40, weight: 1 },
      { type: "score_threshold", pillarId: "cybersecurity", operator: "less_than", value: 60, weight: 1 },
    ]);
    expect(issues).toHaveLength(0);
  });
  it("only checks within the same pillar (no false positive across pillars)", () => {
    const issues = detectContradictoryConditions([
      { type: "score_threshold", pillarId: "cybersecurity", operator: "greater_than", value: 80, weight: 1 },
      { type: "score_threshold", pillarId: "governance", operator: "less_than", value: 60, weight: 1 },
    ]);
    expect(issues).toHaveLength(0);
  });
});

describe("recommendationRuleInputSchema cross-condition refine", () => {
  it("rejects rules with a contradictory threshold pair", () => {
    const r = recommendationRuleInputSchema.safeParse({
      serviceRecommendationId: "ckabcdefghij1234567890klmn",
      ruleName: "bad rule",
      triggerConditions: [
        { type: "score_threshold", pillarId: "cybersecurity", operator: "greater_than", value: 80, weight: 1 },
        { type: "score_threshold", pillarId: "cybersecurity", operator: "less_than", value: 60, weight: 1 },
      ],
      priority: 1,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message.includes("Contradictory"))).toBe(true);
    }
  });
  it("accepts a valid rule with conditions of all 3 types (score + risk + missing)", () => {
    const r = recommendationRuleInputSchema.safeParse({
      serviceRecommendationId: "ckabcdefghij1234567890klmn",
      ruleName: "good rule",
      triggerConditions: [
        { type: "score_threshold", pillarId: "cybersecurity", operator: "less_than", value: 60, weight: 3 },
        { type: "risk_level", pillarId: "cybersecurity", operator: "in", value: ["high", "critical"], weight: 2 },
        { type: "missing_control", questionId: "cyber_password_manager", operator: "equals", weight: 1 },
      ],
      priority: 90,
    });
    expect(r.success).toBe(true);
  });
});

// ── Server actions ───────────────────────────────────────────────────────

describe("createServiceRecommendation", () => {
  it("writes a Prisma row + audit event with action=recommendation.create", async () => {
    prismaSpies.serviceRecommendation.create.mockResolvedValue({ id: "svc-1", name: "Test" });

    const result = await createServiceRecommendation({
      name: "Test service",
      description: "A test",
      category: "test",
      tier: "BASELINE",
      complexity: "MEDIUM",
      implementationType: "ADVISORY",
      priority: 50,
      isActive: true,
    });

    expect(result.success).toBe(true);
    expect(prismaSpies.serviceRecommendation.create).toHaveBeenCalledTimes(1);
    expect(writeAuditSpy).toHaveBeenCalledTimes(1);
    const auditCall = writeAuditSpy.mock.calls[0][0];
    expect(auditCall.action).toBe(AUDIT_ACTIONS.RECOMMENDATION_CREATE);
    expect(auditCall.entityType).toBe("ServiceRecommendation");
    expect(auditCall.entityId).toBe("svc-1");
    expect(auditCall.beforeData).toBeNull();
    expect(auditCall.afterData).toMatchObject({ id: "svc-1" });
  });

  it("returns failure when Zod validation rejects", async () => {
    const result = await createServiceRecommendation({
      name: "",
      description: "x",
      category: "test",
      tier: "BASELINE",
      priority: 50,
      isActive: true,
    } as never);
    expect(result.success).toBe(false);
    expect(prismaSpies.serviceRecommendation.create).not.toHaveBeenCalled();
    expect(writeAuditSpy).not.toHaveBeenCalled();
  });
});

describe("updateServiceRecommendation — audit before/after", () => {
  it("captures both the pre- and post-change rows in the audit row", async () => {
    const before = { id: "svc-1", name: "Old", priority: 1, tier: "BASELINE", isActive: true };
    const after = { id: "svc-1", name: "New", priority: 5, tier: "ENHANCED", isActive: true };
    prismaSpies.serviceRecommendation.findUnique.mockResolvedValue(before);
    prismaSpies.serviceRecommendation.update.mockResolvedValue(after);

    const result = await updateServiceRecommendation({
      id: "ckabcdefghij1234567890klmn",
      name: "New",
      description: "desc",
      category: "test",
      tier: "ENHANCED",
      priority: 5,
      isActive: true,
    });

    expect(result.success).toBe(true);
    const auditCall = writeAuditSpy.mock.calls[0][0];
    expect(auditCall.action).toBe(AUDIT_ACTIONS.RECOMMENDATION_UPDATE);
    expect(auditCall.beforeData).toEqual(before);
    expect(auditCall.afterData).toEqual(after);
  });
});

describe("setServiceRecommendationActive", () => {
  it("toggles isActive and audits with action=recommendation.visibility_toggle", async () => {
    prismaSpies.serviceRecommendation.findUnique.mockResolvedValue({ id: "svc-1", isActive: true, name: "X" });
    prismaSpies.serviceRecommendation.update.mockResolvedValue({ id: "svc-1", isActive: false, name: "X" });

    const result = await setServiceRecommendationActive({ id: "ckabcdefghij1234567890klmn", isActive: false });
    expect(result.success).toBe(true);
    expect(writeAuditSpy.mock.calls[0][0].action).toBe(AUDIT_ACTIONS.RECOMMENDATION_VISIBILITY_TOGGLE);
  });
  it("is a no-op when the new value matches the current value (no audit row)", async () => {
    prismaSpies.serviceRecommendation.findUnique.mockResolvedValue({ id: "svc-1", isActive: true, name: "X" });

    const result = await setServiceRecommendationActive({ id: "ckabcdefghij1234567890klmn", isActive: true });
    expect(result.success).toBe(true);
    expect(prismaSpies.serviceRecommendation.update).not.toHaveBeenCalled();
    expect(writeAuditSpy).not.toHaveBeenCalled();
  });
});

describe("deleteServiceRecommendation", () => {
  it("blocks hard-delete when FK refs exist and suggests soft-delete", async () => {
    prismaSpies.serviceRecommendation.findUnique.mockResolvedValue({
      id: "svc-1",
      _count: { recommendationRules: 2, assessmentRecommendations: 4 },
    });

    const result = await deleteServiceRecommendation({ id: "ckabcdefghij1234567890klmn" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("FK_REFS_BLOCK_DELETE");
      expect(result.error).toMatch(/visibility toggle/);
    }
    expect(prismaSpies.serviceRecommendation.delete).not.toHaveBeenCalled();
    expect(writeAuditSpy).not.toHaveBeenCalled();
  });

  it("hard-deletes + audits when no FK refs exist", async () => {
    const before = { id: "svc-1", _count: { recommendationRules: 0, assessmentRecommendations: 0 } };
    prismaSpies.serviceRecommendation.findUnique.mockResolvedValue(before);
    prismaSpies.serviceRecommendation.delete.mockResolvedValue({ id: "svc-1" });

    const result = await deleteServiceRecommendation({ id: "ckabcdefghij1234567890klmn" });
    expect(result.success).toBe(true);
    expect(prismaSpies.serviceRecommendation.delete).toHaveBeenCalledTimes(1);
    expect(writeAuditSpy.mock.calls[0][0].action).toBe(AUDIT_ACTIONS.RECOMMENDATION_DELETE);
  });
});

describe("createRecommendationRule", () => {
  it("verifies the parent service exists before creating", async () => {
    prismaSpies.serviceRecommendation.findUnique.mockResolvedValue(null);

    const result = await createRecommendationRule({
      serviceRecommendationId: "ckabcdefghij1234567890klmn",
      ruleName: "test rule",
      triggerConditions: [
        { type: "score_threshold", pillarId: "cybersecurity", operator: "less_than", value: 60, weight: 1 },
      ],
      priority: 50,
      isActive: true,
    });

    expect(result.success).toBe(false);
    expect(prismaSpies.recommendationRule.create).not.toHaveBeenCalled();
  });

  it("creates + audits when the parent exists and conditions parse", async () => {
    prismaSpies.serviceRecommendation.findUnique.mockResolvedValue({ id: "svc-1" });
    prismaSpies.recommendationRule.create.mockResolvedValue({ id: "rule-1", ruleName: "test" });

    const result = await createRecommendationRule({
      serviceRecommendationId: "ckabcdefghij1234567890klmn",
      ruleName: "test rule",
      triggerConditions: [
        { type: "score_threshold", pillarId: "cybersecurity", operator: "less_than", value: 60, weight: 1 },
      ],
      priority: 50,
      isActive: true,
    });

    expect(result.success).toBe(true);
    expect(prismaSpies.recommendationRule.create).toHaveBeenCalledTimes(1);
    const auditCall = writeAuditSpy.mock.calls[0][0];
    expect(auditCall.action).toBe(AUDIT_ACTIONS.RECOMMENDATION_RULE_CREATE);
    expect(auditCall.entityType).toBe("RecommendationRule");
  });
});

describe("setRecommendationRuleActive — wraps in single audit row", () => {
  it("toggles + audits", async () => {
    prismaSpies.recommendationRule.findUnique.mockResolvedValue({ id: "rule-1", isActive: false, ruleName: "X" });
    prismaSpies.recommendationRule.update.mockResolvedValue({ id: "rule-1", isActive: true, ruleName: "X" });

    const result = await setRecommendationRuleActive({ id: "ckabcdefghij1234567890klmn", isActive: true });
    expect(result.success).toBe(true);
    expect(writeAuditSpy.mock.calls[0][0].action).toBe(AUDIT_ACTIONS.RECOMMENDATION_RULE_VISIBILITY_TOGGLE);
  });
});

describe("reorderRecommendationRules", () => {
  it("assigns priorities in descending order matching the input list and writes a single REORDER row", async () => {
    prismaSpies.recommendationRule.update.mockImplementation(({ where, data }: { where: { id: string }; data: { priority: number } }) =>
      Promise.resolve({ id: where.id, priority: data.priority })
    );
    prismaSpies.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));

    const result = await reorderRecommendationRules({
      orderedIds: ["ckaaaaaaaaaaaaaaaaaaaaaaaaa", "ckbbbbbbbbbbbbbbbbbbbbbbbbb", "ckccccccccccccccccccccccccc"],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.count).toBe(3);
    }
    expect(writeAuditSpy).toHaveBeenCalledTimes(1);
    const auditCall = writeAuditSpy.mock.calls[0][0];
    expect(auditCall.action).toBe(AUDIT_ACTIONS.RECOMMENDATION_RULE_REORDER);
    expect(auditCall.metadata.orderedIds).toHaveLength(3);
    expect(auditCall.metadata.count).toBe(3);
  });
});

// Exercise serviceRecommendationInputSchema directly so future edits
// to the input shape get caught.
describe("serviceRecommendationInputSchema", () => {
  it("accepts a full canonical input", () => {
    const r = serviceRecommendationInputSchema.safeParse({
      name: "Test",
      description: "Desc",
      category: "security",
      tier: "BASELINE",
      complexity: "MEDIUM",
      implementationType: "ADVISORY",
      priority: 50,
      isActive: true,
    });
    expect(r.success).toBe(true);
  });
  it("requires a tier", () => {
    const r = serviceRecommendationInputSchema.safeParse({
      name: "Test",
      description: "Desc",
      category: "security",
      priority: 50,
      isActive: true,
    } as never);
    expect(r.success).toBe(false);
  });
});
