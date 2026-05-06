/**
 * C1 (BRD §4.4): Zod schemas and cross-condition validation for recommendation
 * rules and service recommendations.
 *
 * Kept out of `admin-recommendation-actions.ts` so that file can remain
 * `"use server"` and export only async server actions — Next.js forbids
 * exporting non-async functions from server action modules.
 *
 * `admin-recommendation-actions.test.ts` asserts enum tuples align with the
 * migration SQL.
 */
import { z } from "zod";

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
  z.string(),
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
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  isActive: z.boolean().default(true),
});

export type ServiceRecommendationInput = z.infer<typeof serviceRecommendationInputSchema>;

export const updateServiceRecommendationSchema = serviceRecommendationInputSchema.extend({
  id: z.string().cuid(),
});
export type UpdateServiceRecommendationInput = z.infer<typeof updateServiceRecommendationSchema>;

export const setServiceActiveSchema = z.object({
  id: z.string().cuid(),
  isActive: z.boolean(),
});

export const deleteServiceSchema = z.object({
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
    questionConditions: z.record(z.string(), z.unknown()).optional().nullable(),
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

export const updateRuleSchema = recommendationRuleInputSchema.extend({
  id: z.string().cuid(),
});
export type UpdateRecommendationRuleInput = z.infer<typeof updateRuleSchema>;

export const setRuleActiveSchema = z.object({
  id: z.string().cuid(),
  isActive: z.boolean(),
});

export const deleteRuleSchema = z.object({
  id: z.string().cuid(),
});

export const reorderRulesSchema = z.object({
  /** Array of rule ids in the desired order; index becomes priority. */
  orderedIds: z.array(z.string().cuid()).min(1),
});
