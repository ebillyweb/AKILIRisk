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
 * Zod schemas and `detectContradictoryConditions` live in
 * `@/lib/admin/recommendation-rule-schemas` so this file stays `"use server"`
 * and exports only async actions.
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
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/admin/auth";
import { logSafeError, safeErrorMessage } from "@/lib/log-safe-error";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import {
  deleteRuleSchema,
  deleteServiceSchema,
  recommendationRuleInputSchema,
  reorderRulesSchema,
  serviceRecommendationInputSchema,
  setRuleActiveSchema,
  setServiceActiveSchema,
  updateRuleSchema,
  updateServiceRecommendationSchema,
  type RecommendationRuleInput,
  type ServiceRecommendationInput,
  type UpdateRecommendationRuleInput,
  type UpdateServiceRecommendationInput,
} from "@/lib/admin/recommendation-rule-schemas";

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
      }) as never,
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
      }) as never,
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
