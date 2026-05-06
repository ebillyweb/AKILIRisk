"use server";

/**
 * C1 (BRD §4.4): Admin server actions for the recommendations editor.
 *
 * Two entities live here:
 *   - ServiceRecommendation (the catalog: name, description, tier,
 *     complexity, implementation type, etc.)
 *   - RecommendationRule    (the matching rules that the recommendation
 *     engine evaluates against scored assessments)
 *
 * All write paths:
 *   - require admin role (`requireAdminRole()`)
 *   - validate input through Zod (errors surface to the client form)
 *   - audit-log via the round-7 infrastructure with new constants from
 *     RECOMMENDATION_* / RECOMMENDATION_RULE_*
 *   - revalidate /admin/recommendations on success
 *
 * Soft delete = `setActive(false)`; hard delete only when no FK refs
 * exist (otherwise the action returns a structured error suggesting the
 * soft-delete path).
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/admin/auth";
import { logSafeError, safeErrorMessage } from "@/lib/log-safe-error";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";

// ── Enum mirrors ─────────────────────────────────────────────────────────
//
// These mirror the Prisma enums added by the C1 migration
// (20260505150000_recommendation_classification). Defined here as `as const`
// tuples so:
//   (1) the Zod schema can reference them via z.enum(TIER_VALUES)
//   (2) call sites get string-literal types without depending on the
//       Prisma client type having been regenerated yet (we check string
//       values at the boundary; Prisma accepts strings for enum columns
//       at runtime).
//
// When `npx prisma generate` is run, Prisma also emits matching enums; the
// values here MUST match those exactly. The vitest test in
// `admin-recommendation-actions.test.ts` asserts the tuples line up with
// the migration SQL.

export const TIER_VALUES = ["BASELINE", "ENHANCED"] as const;
export const COMPLEXITY_VALUES = ["LOW", "MEDIUM", "HIGH"] as const;
export const IMPLEMENTATION_TYPE_VALUES = ["DIY", "ADVISORY", "HYBRID"] as const;

export type RecommendationTier = (typeof TIER_VALUES)[number];
export type RecommendationComplexity = (typeof COMPLEXITY_VALUES)[number];
export type ImplementationType = (typeof IMPLEMENTATION_TYPE_VALUES)[number];

// ── Condition schema (discriminated union) ───────────────────────────────
//
// This is the canonical shape of a single matching condition stored in
// `RecommendationRule.triggerConditions`. It mirrors how the engine
// dispatches on `type` in src/lib/assessment/engines/recommendation-engine.ts
// (evaluateScoreThreshold, evaluateRiskLevel, evaluateAnswerMatch,
// evaluateMissingControl, evaluateProfileCondition).
//
// We use z.discriminatedUnion so each variant has its own required-field
// rules and a typed `value`. This makes the admin form reject malformed
// rules before they ever reach the DB — a typo'd `score_threshhold` or
// a `risk_level` condition with `value: 123` both fail at parse time
// rather than silently never matching.

const RISK_LEVEL_VALUES = ["low", "medium", "high", "critical"] as const;
const WEIGHT_FIELD = z.number().int().min(1).max(10).default(1);

/** score_threshold: numeric pillar-score comparison.
 *  Engine: evaluateScoreThreshold (operators: greater_than | less_than | equals
 *  against a Number-coerced value). */
const scoreThresholdConditionSchema = z.object({
  type: z.literal("score_threshold"),
  pillarId: z.string().min(1, "score_threshold needs a pillarId").max(100),
  operator: z.enum(["greater_than", "less_than", "equals"]),
  value: z.number({ message: "score_threshold value must be a number" }),
  weight: WEIGHT_FIELD,
});

/** risk_level: comparison against the pillar's persisted RiskLevel.
 *  Engine: evaluateRiskLevel (operators: equals | in). For `in`, value
 *  must be a non-empty array of risk levels; for `equals`, a single level.
 *
 *  Implemented as a single ZodObject (not a nested discriminatedUnion)
 *  because Zod's outer discriminatedUnion requires every member to be a
 *  ZodObject. The per-operator value-shape constraints are enforced via
 *  `.superRefine` below. */
const riskLevelConditionSchema = z
  .object({
    type: z.literal("risk_level"),
    pillarId: z.string().min(1, "risk_level needs a pillarId").max(100),
    operator: z.enum(["equals", "in"]),
    value: z.union([
      z.enum(RISK_LEVEL_VALUES),
      z.array(z.enum(RISK_LEVEL_VALUES)),
    ]),
    weight: WEIGHT_FIELD,
  })
  .superRefine((c, ctx) => {
    if (c.operator === "equals") {
      if (Array.isArray(c.value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["value"],
          message: "risk_level equals value must be a single risk level (one of: " + RISK_LEVEL_VALUES.join(", ") + ")",
        });
      }
    } else {
      // operator === "in"
      if (!Array.isArray(c.value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["value"],
          message: "risk_level in[] must be an array of one or more risk levels",
        });
      } else if (c.value.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["value"],
          message: "risk_level in[] must list at least one level",
        });
      }
    }
  });

/** answer_match: compares context.answers[questionId] to value.
 *  Engine: evaluateAnswerMatch (operators: equals | in | contains).
 *  - equals: exact match on a string/number/boolean answer.
 *  - in: value is an array; passes if answer is one of the listed entries.
 *  - contains: answer must be an array containing the value (multi-select).
 *
 *  Same flattened-with-superRefine pattern as risk_level above. */
const answerMatchScalar = z.union([z.string(), z.number(), z.boolean()]);
const answerMatchConditionSchema = z
  .object({
    type: z.literal("answer_match"),
    questionId: z.string().min(1, "answer_match needs a questionId").max(200),
    operator: z.enum(["equals", "in", "contains"]),
    value: z.union([answerMatchScalar, z.array(answerMatchScalar)]),
    weight: WEIGHT_FIELD,
  })
  .superRefine((c, ctx) => {
    if (c.operator === "in") {
      if (!Array.isArray(c.value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["value"],
          message: "answer_match in[] must be an array of one or more values",
        });
      } else if (c.value.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["value"],
          message: "answer_match in[] must list at least one value",
        });
      }
    } else {
      // equals + contains both compare against a single scalar answer-side.
      if (Array.isArray(c.value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["value"],
          message: `answer_match ${c.operator} value must be a scalar (string, number, or boolean)`,
        });
      }
    }
  });

/** missing_control: presence check in context.missingControls. The engine
 *  matches on `control.questionId === condition.questionId` (the value
 *  branch is allowed by the engine but underused; we drop it to keep the
 *  schema unambiguous — questionId is the canonical key). Operator is
 *  fixed to `equals` since "missing-or-not" has no other meaningful
 *  comparison. */
const missingControlConditionSchema = z.object({
  type: z.literal("missing_control"),
  questionId: z.string().min(1, "missing_control needs a questionId").max(200),
  operator: z.literal("equals"),
  weight: WEIGHT_FIELD,
});

/** profile_condition: comparison against the household profile.
 *  Engine: evaluateProfileCondition is currently a placeholder (returns
 *  true). We tighten the shape now so once someone implements it, the
 *  data is already typed. `field` is a dot-path into the household
 *  profile (e.g. "size", "members.length"). */
const profileConditionValueSchema = z.union([
  z.number(),
  z.string(),
  z.array(z.union([z.number(), z.string()])),
]);
const profileConditionSchema = z.object({
  type: z.literal("profile_condition"),
  /** Dot-path into context.householdProfile (engine implementation TBD). */
  field: z.string().min(1, "profile_condition needs a field path").max(200),
  operator: z.enum(["greater_than", "less_than", "equals", "in"]),
  value: profileConditionValueSchema,
  weight: WEIGHT_FIELD,
});

/** Discriminated union over the type tag. */
export const conditionSchema = z.discriminatedUnion("type", [
  scoreThresholdConditionSchema,
  riskLevelConditionSchema,
  answerMatchConditionSchema,
  missingControlConditionSchema,
  profileConditionSchema,
]);

export type RecommendationCondition = z.infer<typeof conditionSchema>;

// ── Cross-condition validation ───────────────────────────────────────────
//
// Catch the obvious "this rule can never match" cases. We don't try to be
// exhaustive — just the contradictory score_threshold pair where one
// condition demands `> X` and another demands `< Y` on the same pillar
// with Y <= X (impossible without skipping one of them).
//
// Returns a Zod-style issue list keyed by the first contradictory pair so
// the form can highlight the relevant rows.

interface ContradictionIssue {
  message: string;
  /** Indices into the triggerConditions array. */
  conditionIndices: [number, number];
}

export function detectContradictoryConditions(
  conditions: RecommendationCondition[]
): ContradictionIssue[] {
  const issues: ContradictionIssue[] = [];

  // Group score_threshold conditions by pillarId.
  const byPillar = new Map<string, Array<{ index: number; cond: typeof conditions[number] & { type: "score_threshold" } }>>();
  for (let i = 0; i < conditions.length; i++) {
    const c = conditions[i];
    if (c.type !== "score_threshold") continue;
    const arr = byPillar.get(c.pillarId) ?? [];
    arr.push({ index: i, cond: c });
    byPillar.set(c.pillarId, arr);
  }

  for (const [pillarId, group] of byPillar) {
    // Find the loosest greater_than lower bound and the tightest less_than upper bound.
    let lowerBound: { index: number; value: number } | null = null;
    let upperBound: { index: number; value: number } | null = null;
    for (const { index, cond } of group) {
      if (cond.operator === "greater_than") {
        if (!lowerBound || cond.value > lowerBound.value) {
          lowerBound = { index, value: cond.value };
        }
      } else if (cond.operator === "less_than") {
        if (!upperBound || cond.value < upperBound.value) {
          upperBound = { index, value: cond.value };
        }
      }
    }
    if (lowerBound && upperBound && upperBound.value <= lowerBound.value) {
      issues.push({
        message: `Contradictory score_threshold pair on pillar "${pillarId}": requires > ${lowerBound.value} AND < ${upperBound.value} (impossible).`,
        conditionIndices: [lowerBound.index, upperBound.index],
      });
    }
  }

  return issues;
}

/** Pillar-thresholds shape: { pillarName: { min, max } }. */
export const pillarThresholdsSchema = z.record(
  z.object({
    min: z.number(),
    max: z.number(),
  })
);

// ── ServiceRecommendation schemas ────────────────────────────────────────

export const serviceRecommendationInputSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().min(1, "Description is required").max(2000),
  /** Free-form domain tag (existing seed data uses governance, advisory,
   *  insurance, legal, reputation, security). Not enum-locked because
   *  changing to enum would break seed scripts; UI offers a datalist hint. */
  category: z.string().min(1, "Category is required").max(50),
  tier: z.enum(TIER_VALUES),
  complexity: z.enum(COMPLEXITY_VALUES).optional().nullable(),
  implementationType: z.enum(IMPLEMENTATION_TYPE_VALUES).optional().nullable(),
  priority: z.number().int().min(0).max(1000),
  estimatedCost: z.string().max(100).optional().nullable(),
  timeframe: z.string().max(100).optional().nullable(),
  provider: z.string().max(200).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
  isActive: z.boolean().default(true),
});

export type ServiceRecommendationInput = z.infer<typeof serviceRecommendationInputSchema>;

const updateServiceRecommendationSchema = serviceRecommendationInputSchema.extend({
  id: z.string().cuid(),
});
export type UpdateServiceRecommendationInput = z.infer<typeof updateServiceRecommendationSchema>;

const setServiceActiveSchema = z.object({
  id: z.string().cuid(),
  isActive: z.boolean(),
});

const deleteServiceSchema = z.object({
  id: z.string().cuid(),
});

// ── RecommendationRule schemas ───────────────────────────────────────────

export const recommendationRuleInputSchema = z
  .object({
    serviceRecommendationId: z.string().cuid("Pick a service recommendation"),
    ruleName: z.string().min(1, "Rule name is required").max(200),
    description: z.string().max(2000).optional().nullable(),
    /** At least one condition required — otherwise the engine's
     *  satisfiedWeight/totalWeight ratio divides by zero. */
    triggerConditions: z.array(conditionSchema).min(1, "At least one condition is required"),
    pillarThresholds: pillarThresholdsSchema.optional().nullable(),
    questionConditions: z.record(z.unknown()).optional().nullable(),
    priority: z.number().int().min(0).max(1000),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    const issues = detectContradictoryConditions(data.triggerConditions);
    for (const issue of issues) {
      // Attach the issue to the first index in the contradictory pair so the
      // form can highlight the right row.
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["triggerConditions", issue.conditionIndices[0]],
        message: issue.message,
      });
    }
  });

export type RecommendationRuleInput = z.infer<typeof recommendationRuleInputSchema>;

const updateRuleSchema = recommendationRuleInputSchema.extend({
  id: z.string().cuid(),
});
export type UpdateRecommendationRuleInput = z.infer<typeof updateRuleSchema>;

const setRuleActiveSchema = z.object({
  id: z.string().cuid(),
  isActive: z.boolean(),
});

const deleteRuleSchema = z.object({
  id: z.string().cuid(),
});

const reorderRulesSchema = z.object({
  /** Array of rule ids in the desired order; index becomes priority. */
  orderedIds: z.array(z.string().cuid()).min(1),
});

// ── Result types ─────────────────────────────────────────────────────────

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: "FK_REFS_BLOCK_DELETE" };

function fail(error: string, code?: "FK_REFS_BLOCK_DELETE"): ActionResult<never> {
  return { success: false, error, code };
}

function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

function revalidate() {
  revalidatePath("/admin/recommendations");
  revalidatePath("/admin/recommendations", "layout");
}

// Strip undefined keys so Prisma update doesn't try to write them.
function pruneUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

// ── ServiceRecommendation actions ────────────────────────────────────────

export async function createServiceRecommendation(
  input: ServiceRecommendationInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireAdminRole();
    const parsed = serviceRecommendationInputSchema.parse(input);

    const created = await prisma.serviceRecommendation.create({
      // Cast to never so the new tier/complexity/implementationType
      // fields type-check before `prisma generate` is rerun locally.
      // Runtime accepts string values directly for Prisma enum columns.
      data: pruneUndefined({
        name: parsed.name,
        description: parsed.description,
        category: parsed.category,
        priority: parsed.priority,
        estimatedCost: parsed.estimatedCost ?? undefined,
        timeframe: parsed.timeframe ?? undefined,
        provider: parsed.provider ?? undefined,
        metadata: (parsed.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        isActive: parsed.isActive,
        tier: parsed.tier,
        complexity: parsed.complexity ?? undefined,
        implementationType: parsed.implementationType ?? undefined,
      }) as never,
    });

    await writeAudit({
      actor: { userId: actor.userId, role: "ADMIN", email: actor.email },
      action: AUDIT_ACTIONS.RECOMMENDATION_CREATE,
      entityType: "ServiceRecommendation",
      entityId: created.id,
      beforeData: null,
      afterData: created,
    });

    revalidate();
    return ok({ id: created.id });
  } catch (err) {
    logSafeError("createServiceRecommendation", err);
    return fail(safeErrorMessage(err, "Failed to create recommendation"));
  }
}

export async function updateServiceRecommendation(
  input: UpdateServiceRecommendationInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireAdminRole();
    const parsed = updateServiceRecommendationSchema.parse(input);

    const before = await prisma.serviceRecommendation.findUnique({
      where: { id: parsed.id },
    });
    if (!before) return fail("Recommendation not found");

    const updated = await prisma.serviceRecommendation.update({
      where: { id: parsed.id },
      data: pruneUndefined({
        name: parsed.name,
        description: parsed.description,
        category: parsed.category,
        priority: parsed.priority,
        estimatedCost: parsed.estimatedCost ?? null,
        timeframe: parsed.timeframe ?? null,
        provider: parsed.provider ?? null,
        metadata: (parsed.metadata ?? null) as Prisma.InputJsonValue | null,
        isActive: parsed.isActive,
        tier: parsed.tier,
        complexity: parsed.complexity ?? null,
        implementationType: parsed.implementationType ?? null,
      }) as never,
    });

    await writeAudit({
      actor: { userId: actor.userId, role: "ADMIN", email: actor.email },
      action: AUDIT_ACTIONS.RECOMMENDATION_UPDATE,
      entityType: "ServiceRecommendation",
      entityId: parsed.id,
      beforeData: before,
      afterData: updated,
    });

    revalidate();
    return ok({ id: updated.id });
  } catch (err) {
    logSafeError("updateServiceRecommendation", err);
    return fail(safeErrorMessage(err, "Failed to update recommendation"));
  }
}

export async function setServiceRecommendationActive(
  input: { id: string; isActive: boolean }
): Promise<ActionResult<{ id: string; isActive: boolean }>> {
  try {
    const actor = await requireAdminRole();
    const parsed = setServiceActiveSchema.parse(input);

    const before = await prisma.serviceRecommendation.findUnique({
      where: { id: parsed.id },
      select: { id: true, isActive: true, name: true },
    });
    if (!before) return fail("Recommendation not found");

    if (before.isActive === parsed.isActive) {
      // No-op — don't audit-log churn.
      return ok({ id: parsed.id, isActive: parsed.isActive });
    }

    const updated = await prisma.serviceRecommendation.update({
      where: { id: parsed.id },
      data: { isActive: parsed.isActive },
      select: { id: true, isActive: true, name: true },
    });

    await writeAudit({
      actor: { userId: actor.userId, role: "ADMIN", email: actor.email },
      action: AUDIT_ACTIONS.RECOMMENDATION_VISIBILITY_TOGGLE,
      entityType: "ServiceRecommendation",
      entityId: parsed.id,
      beforeData: before,
      afterData: updated,
    });

    revalidate();
    return ok({ id: updated.id, isActive: updated.isActive });
  } catch (err) {
    logSafeError("setServiceRecommendationActive", err);
    return fail(safeErrorMessage(err, "Failed to toggle visibility"));
  }
}

export async function deleteServiceRecommendation(
  input: { id: string }
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireAdminRole();
    const parsed = deleteServiceSchema.parse(input);

    const before = await prisma.serviceRecommendation.findUnique({
      where: { id: parsed.id },
      include: {
        _count: { select: { recommendationRules: true, assessmentRecommendations: true } },
      },
    });
    if (!before) return fail("Recommendation not found");

    // Hard-delete only when no FK refs exist. Rules cascade
    // automatically (schema-level) but historical AssessmentRecommendation
    // rows would block the delete with RESTRICT — surface the helpful
    // soft-delete suggestion instead of letting Prisma throw.
    if (before._count.recommendationRules > 0 || before._count.assessmentRecommendations > 0) {
      return fail(
        `Cannot hard-delete: ${before._count.recommendationRules} rules + ${before._count.assessmentRecommendations} historical assessments reference this recommendation. Use the visibility toggle (isActive=false) instead.`,
        "FK_REFS_BLOCK_DELETE"
      );
    }

    await prisma.serviceRecommendation.delete({ where: { id: parsed.id } });

    await writeAudit({
      actor: { userId: actor.userId, role: "ADMIN", email: actor.email },
      action: AUDIT_ACTIONS.RECOMMENDATION_DELETE,
      entityType: "ServiceRecommendation",
      entityId: parsed.id,
      beforeData: before,
      afterData: null,
    });

    revalidate();
    return ok({ id: parsed.id });
  } catch (err) {
    logSafeError("deleteServiceRecommendation", err);
    return fail(safeErrorMessage(err, "Failed to delete recommendation"));
  }
}

// ── RecommendationRule actions ───────────────────────────────────────────

export async function createRecommendationRule(
  input: RecommendationRuleInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireAdminRole();
    const parsed = recommendationRuleInputSchema.parse(input);

    // Verify the parent service exists (Prisma would throw a P2003 FK
    // error otherwise; surfacing a friendlier message).
    const parent = await prisma.serviceRecommendation.findUnique({
      where: { id: parsed.serviceRecommendationId },
      select: { id: true },
    });
    if (!parent) return fail("Service recommendation not found");

    const created = await prisma.recommendationRule.create({
      data: pruneUndefined({
        serviceRecommendationId: parsed.serviceRecommendationId,
        ruleName: parsed.ruleName,
        description: parsed.description ?? undefined,
        triggerConditions: parsed.triggerConditions as unknown as Prisma.InputJsonValue,
        pillarThresholds: (parsed.pillarThresholds ?? undefined) as Prisma.InputJsonValue | undefined,
        questionConditions: (parsed.questionConditions ?? undefined) as Prisma.InputJsonValue | undefined,
        priority: parsed.priority,
        isActive: parsed.isActive,
      }),
    });

    await writeAudit({
      actor: { userId: actor.userId, role: "ADMIN", email: actor.email },
      action: AUDIT_ACTIONS.RECOMMENDATION_RULE_CREATE,
      entityType: "RecommendationRule",
      entityId: created.id,
      beforeData: null,
      afterData: created,
    });

    revalidate();
    return ok({ id: created.id });
  } catch (err) {
    logSafeError("createRecommendationRule", err);
    return fail(safeErrorMessage(err, "Failed to create rule"));
  }
}

export async function updateRecommendationRule(
  input: UpdateRecommendationRuleInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireAdminRole();
    const parsed = updateRuleSchema.parse(input);

    const before = await prisma.recommendationRule.findUnique({ where: { id: parsed.id } });
    if (!before) return fail("Rule not found");

    const updated = await prisma.recommendationRule.update({
      where: { id: parsed.id },
      data: pruneUndefined({
        serviceRecommendationId: parsed.serviceRecommendationId,
        ruleName: parsed.ruleName,
        description: parsed.description ?? null,
        triggerConditions: parsed.triggerConditions as unknown as Prisma.InputJsonValue,
        pillarThresholds: (parsed.pillarThresholds ?? null) as Prisma.InputJsonValue | null,
        questionConditions: (parsed.questionConditions ?? null) as Prisma.InputJsonValue | null,
        priority: parsed.priority,
        isActive: parsed.isActive,
      }),
    });

    await writeAudit({
      actor: { userId: actor.userId, role: "ADMIN", email: actor.email },
      action: AUDIT_ACTIONS.RECOMMENDATION_RULE_UPDATE,
      entityType: "RecommendationRule",
      entityId: parsed.id,
      beforeData: before,
      afterData: updated,
    });

    revalidate();
    return ok({ id: updated.id });
  } catch (err) {
    logSafeError("updateRecommendationRule", err);
    return fail(safeErrorMessage(err, "Failed to update rule"));
  }
}

export async function setRecommendationRuleActive(
  input: { id: string; isActive: boolean }
): Promise<ActionResult<{ id: string; isActive: boolean }>> {
  try {
    const actor = await requireAdminRole();
    const parsed = setRuleActiveSchema.parse(input);

    const before = await prisma.recommendationRule.findUnique({
      where: { id: parsed.id },
      select: { id: true, isActive: true, ruleName: true },
    });
    if (!before) return fail("Rule not found");
    if (before.isActive === parsed.isActive) return ok({ id: parsed.id, isActive: parsed.isActive });

    const updated = await prisma.recommendationRule.update({
      where: { id: parsed.id },
      data: { isActive: parsed.isActive },
      select: { id: true, isActive: true, ruleName: true },
    });

    await writeAudit({
      actor: { userId: actor.userId, role: "ADMIN", email: actor.email },
      action: AUDIT_ACTIONS.RECOMMENDATION_RULE_VISIBILITY_TOGGLE,
      entityType: "RecommendationRule",
      entityId: parsed.id,
      beforeData: before,
      afterData: updated,
    });

    revalidate();
    return ok({ id: updated.id, isActive: updated.isActive });
  } catch (err) {
    logSafeError("setRecommendationRuleActive", err);
    return fail(safeErrorMessage(err, "Failed to toggle rule visibility"));
  }
}

export async function deleteRecommendationRule(
  input: { id: string }
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireAdminRole();
    const parsed = deleteRuleSchema.parse(input);

    const before = await prisma.recommendationRule.findUnique({ where: { id: parsed.id } });
    if (!before) return fail("Rule not found");

    await prisma.recommendationRule.delete({ where: { id: parsed.id } });

    await writeAudit({
      actor: { userId: actor.userId, role: "ADMIN", email: actor.email },
      action: AUDIT_ACTIONS.RECOMMENDATION_RULE_DELETE,
      entityType: "RecommendationRule",
      entityId: parsed.id,
      beforeData: before,
      afterData: null,
    });

    revalidate();
    return ok({ id: parsed.id });
  } catch (err) {
    logSafeError("deleteRecommendationRule", err);
    return fail(safeErrorMessage(err, "Failed to delete rule"));
  }
}

export async function reorderRecommendationRules(
  input: { orderedIds: string[] }
): Promise<ActionResult<{ count: number }>> {
  try {
    const actor = await requireAdminRole();
    const parsed = reorderRulesSchema.parse(input);

    // Single transaction: bulk-update each rule's priority to match its
    // index in the ordered list. Index 0 → highest priority (descending);
    // we use `orderedIds.length - i` so the first listed rule gets the
    // largest priority number, matching the engine's `orderBy: { priority: "desc" }`.
    const ops = parsed.orderedIds.map((id, i) =>
      prisma.recommendationRule.update({
        where: { id },
        data: { priority: parsed.orderedIds.length - i },
      })
    );
    const result = await prisma.$transaction(ops);

    await writeAudit({
      actor: { userId: actor.userId, role: "ADMIN", email: actor.email },
      action: AUDIT_ACTIONS.RECOMMENDATION_RULE_REORDER,
      entityType: "RecommendationRule",
      entityId: null,
      beforeData: null,
      afterData: null,
      metadata: { orderedIds: parsed.orderedIds, count: result.length },
    });

    revalidate();
    return ok({ count: result.length });
  } catch (err) {
    logSafeError("reorderRecommendationRules", err);
    return fail(safeErrorMessage(err, "Failed to reorder rules"));
  }
}
