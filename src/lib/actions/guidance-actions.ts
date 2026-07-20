"use server";

/**
 * Advisor guidance review server actions.
 *
 * All actions:
 * - require advisor role
 * - verify the advisor owns the client via ClientAdvisorAssignment
 * - validate input with Zod
 * - use try/catch with logSafeError
 * - revalidate /advisor/clients on success
 *
 * Lifecycle transitions delegate to transitionRecommendationStatus().
 * Direct field updates (hide, priority, notes, etc.) go through Prisma.
 */

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdvisorRole } from "@/lib/advisor/auth";
import { assertAdvisorCanManageActionPlan } from "@/lib/enterprise/advisor-member-visibility";
import { logSafeError, safeErrorMessage } from "@/lib/log-safe-error";
import { transitionRecommendationStatus } from "@/lib/recommendations/solution-lifecycle";
import {
  includeSchema,
  deferSchema,
  bulkDeferSchema,
  hideFromClientSchema,
  adjustPrioritySchema,
  updateNotesSchema,
  validationStatusSchema,
  narrativeEditSchema,
  narrativeApprovalSchema,
  updateTimeHorizonSchema,
  updateRolesSchema,
  updateAssigneesSchema,
  type IncludeInput,
  type DeferInput,
  type BulkDeferInput,
  type HideFromClientInput,
  type AdjustPriorityInput,
  type UpdateNotesInput,
  type ValidationStatusInput,
  type NarrativeEditInput,
  type NarrativeApprovalInput,
  type UpdateTimeHorizonInput,
  type UpdateRolesInput,
  type UpdateAssigneesInput,
} from "./guidance-schemas";
import {
  applyNarrativeEdit,
  approveNarrative,
  unapproveNarrative,
  parseReview,
  type EditableNarrative,
} from "@/lib/assessment/recommendations/llm-narrative/narrative-review";

// ── Result types ─────────────────────────────────────────────────────────

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

function fail(error: string): ActionResult<never> {
  return { success: false, error };
}

function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

function revalidate() {
  revalidatePath("/advisor/clients");
}

// ── Ownership helpers ────────────────────────────────────────────────────

/**
 * Verify that the advisor (by userId) owns the recommendation via
 * AssessmentRecommendation -> Assessment (userId) -> ClientAdvisorAssignment.
 */
export async function verifyAdvisorOwnsRecommendation(
  advisorUserId: string,
  recommendationId: string
): Promise<boolean> {
  const rec = await prisma.assessmentRecommendation.findUnique({
    where: { id: recommendationId },
    select: {
      assessment: {
        select: {
          userId: true,
        },
      },
    },
  });
  if (!rec) return false;

  const advisorProfile = await prisma.advisorProfile.findUnique({
    where: { userId: advisorUserId },
    select: { id: true },
  });
  if (!advisorProfile) return false;

  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: {
      clientId: rec.assessment.userId,
      advisorId: advisorProfile.id,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  return assignment !== null;
}

/**
 * Verify ownership for a batch of recommendation IDs.
 * Returns which IDs are valid vs unauthorized.
 */
export async function verifyAdvisorOwnsRecommendations(
  advisorUserId: string,
  recommendationIds: string[]
): Promise<{ valid: string[]; unauthorized: string[] }> {
  const advisorProfile = await prisma.advisorProfile.findUnique({
    where: { userId: advisorUserId },
    select: { id: true },
  });
  if (!advisorProfile) {
    return { valid: [], unauthorized: recommendationIds };
  }

  // Get all recommendations with their assessment client IDs in one query
  const recs = await prisma.assessmentRecommendation.findMany({
    where: { id: { in: recommendationIds } },
    select: {
      id: true,
      assessment: { select: { userId: true } },
    },
  });

  // Find which client IDs we need to check
  const clientIds = [...new Set(recs.map((r) => r.assessment.userId))];

  // Get all active assignments for these clients
  const assignments = await prisma.clientAdvisorAssignment.findMany({
    where: {
      clientId: { in: clientIds },
      advisorId: advisorProfile.id,
      status: "ACTIVE",
    },
    select: { clientId: true },
  });

  const assignedClientIds = new Set(assignments.map((a) => a.clientId));
  const foundIds = new Set(recs.map((r) => r.id));

  const valid: string[] = [];
  const unauthorized: string[] = [];

  for (const id of recommendationIds) {
    const rec = recs.find((r) => r.id === id);
    if (!rec || !assignedClientIds.has(rec.assessment.userId)) {
      unauthorized.push(id);
    } else {
      valid.push(id);
    }
  }

  // IDs not found in DB are also unauthorized
  for (const id of recommendationIds) {
    if (!foundIds.has(id) && !unauthorized.includes(id)) {
      unauthorized.push(id);
    }
  }

  return { valid, unauthorized };
}

// ── Advisor actions ──────────────────────────────────────────────────────

/**
 * Include one or more recommendations in the client's action plan.
 * Uses a single transaction to avoid Pitfall 4 (race condition on bulk).
 */
export async function includeInActionPlan(
  input: IncludeInput
): Promise<ActionResult<{ results: Array<{ id: string; success: boolean; error?: string }> }>> {
  try {
    const { userId } = await requireAdvisorRole();
    await assertAdvisorCanManageActionPlan(userId);
    const parsed = includeSchema.parse(input);

    const { valid, unauthorized } = await verifyAdvisorOwnsRecommendations(
      userId,
      parsed.recommendationIds
    );

    if (valid.length === 0) {
      return fail("No authorized recommendations found");
    }

    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    // Mark unauthorized items
    for (const id of unauthorized) {
      results.push({ id, success: false, error: "Unauthorized" });
    }

    // Process valid items in a single transaction
    await prisma.$transaction(async (_tx) => {
      for (const id of valid) {
        try {
          await transitionRecommendationStatus({
            recommendationId: id,
            newStatus: "INCLUDED",
            actorId: userId,
          });
          results.push({ id, success: true });
        } catch (err) {
          results.push({
            id,
            success: false,
            error: err instanceof Error ? err.message : "Transition failed",
          });
        }
      }
    });

    revalidate();
    return ok({ results });
  } catch (err) {
    logSafeError("includeInActionPlan", err);
    return fail(safeErrorMessage(err, "Failed to include recommendations"));
  }
}

/**
 * Defer a single recommendation with required reason and optional revisit details.
 */
export async function deferRecommendation(
  input: DeferInput
): Promise<ActionResult<void>> {
  try {
    const { userId } = await requireAdvisorRole();
    const parsed = deferSchema.parse(input);

    const owns = await verifyAdvisorOwnsRecommendation(userId, parsed.recommendationId);
    if (!owns) return fail("Recommendation not found or not authorized");

    await transitionRecommendationStatus({
      recommendationId: parsed.recommendationId,
      newStatus: "DEFERRED",
      actorId: userId,
      reason: parsed.reason,
      notes: parsed.notes,
      deferredRevisitDate: parsed.revisitDate ? new Date(parsed.revisitDate) : undefined,
      deferredTriggerEvent: parsed.triggerEvent,
    });

    revalidate();
    return ok(undefined);
  } catch (err) {
    logSafeError("deferRecommendation", err);
    return fail(safeErrorMessage(err, "Failed to defer recommendation"));
  }
}

/**
 * Defer multiple recommendations with the same reason in a single transaction.
 */
export async function bulkDefer(
  input: BulkDeferInput
): Promise<ActionResult<{ results: Array<{ id: string; success: boolean; error?: string }> }>> {
  try {
    const { userId } = await requireAdvisorRole();
    const parsed = bulkDeferSchema.parse(input);

    const { valid, unauthorized } = await verifyAdvisorOwnsRecommendations(
      userId,
      parsed.recommendationIds
    );

    if (valid.length === 0) {
      return fail("No authorized recommendations found");
    }

    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const id of unauthorized) {
      results.push({ id, success: false, error: "Unauthorized" });
    }

    await prisma.$transaction(async (_tx) => {
      for (const id of valid) {
        try {
          await transitionRecommendationStatus({
            recommendationId: id,
            newStatus: "DEFERRED",
            actorId: userId,
            reason: parsed.reason,
            deferredRevisitDate: parsed.revisitDate ? new Date(parsed.revisitDate) : undefined,
          });
          results.push({ id, success: true });
        } catch (err) {
          results.push({
            id,
            success: false,
            error: err instanceof Error ? err.message : "Transition failed",
          });
        }
      }
    });

    revalidate();
    return ok({ results });
  } catch (err) {
    logSafeError("bulkDefer", err);
    return fail(safeErrorMessage(err, "Failed to defer recommendations"));
  }
}

/**
 * Hide or unhide a recommendation from the client view.
 */
export async function hideFromClient(
  input: HideFromClientInput
): Promise<ActionResult<void>> {
  try {
    const { userId } = await requireAdvisorRole();
    const parsed = hideFromClientSchema.parse(input);

    const owns = await verifyAdvisorOwnsRecommendation(userId, parsed.recommendationId);
    if (!owns) return fail("Recommendation not found or not authorized");

    await prisma.assessmentRecommendation.update({
      where: { id: parsed.recommendationId },
      data: { hiddenFromClient: parsed.hidden },
    });

    await prisma.solutionActivity.create({
      data: {
        assessmentRecommendationId: parsed.recommendationId,
        actorId: userId,
        action: parsed.hidden ? "hide_from_client" : "unhide_from_client",
        detail: { hidden: parsed.hidden },
      },
    });

    revalidate();
    return ok(undefined);
  } catch (err) {
    logSafeError("hideFromClient", err);
    return fail(safeErrorMessage(err, "Failed to update visibility"));
  }
}

/**
 * Override the platform urgency priority with advisor-specified HIGH/MEDIUM/LOW.
 */
export async function adjustPriority(
  input: AdjustPriorityInput
): Promise<ActionResult<void>> {
  try {
    const { userId } = await requireAdvisorRole();
    const parsed = adjustPrioritySchema.parse(input);

    const owns = await verifyAdvisorOwnsRecommendation(userId, parsed.recommendationId);
    if (!owns) return fail("Recommendation not found or not authorized");

    await prisma.assessmentRecommendation.update({
      where: { id: parsed.recommendationId },
      data: { advisorPriority: parsed.priority },
    });

    await prisma.solutionActivity.create({
      data: {
        assessmentRecommendationId: parsed.recommendationId,
        actorId: userId,
        action: "priority_adjustment",
        detail: { priority: parsed.priority },
      },
    });

    revalidate();
    return ok(undefined);
  } catch (err) {
    logSafeError("adjustPriority", err);
    return fail(safeErrorMessage(err, "Failed to adjust priority"));
  }
}

/**
 * Update advisor notes on a recommendation. No activity log (editorial, not lifecycle).
 */
export async function updateAdvisorNotes(
  input: UpdateNotesInput
): Promise<ActionResult<void>> {
  try {
    const { userId } = await requireAdvisorRole();
    const parsed = updateNotesSchema.parse(input);

    const owns = await verifyAdvisorOwnsRecommendation(userId, parsed.recommendationId);
    if (!owns) return fail("Recommendation not found or not authorized");

    await prisma.assessmentRecommendation.update({
      where: { id: parsed.recommendationId },
      data: { advisorNotes: parsed.notes },
    });

    revalidate();
    return ok(undefined);
  } catch (err) {
    logSafeError("updateAdvisorNotes", err);
    return fail(safeErrorMessage(err, "Failed to update notes"));
  }
}

/**
 * Update advisor validation status on a recommendation.
 */
export async function updateValidationStatus(
  input: ValidationStatusInput
): Promise<ActionResult<void>> {
  try {
    const { userId } = await requireAdvisorRole();
    const parsed = validationStatusSchema.parse(input);

    const owns = await verifyAdvisorOwnsRecommendation(userId, parsed.recommendationId);
    if (!owns) return fail("Recommendation not found or not authorized");

    await prisma.assessmentRecommendation.update({
      where: { id: parsed.recommendationId },
      data: { validationStatus: parsed.status },
    });

    await prisma.solutionActivity.create({
      data: {
        assessmentRecommendationId: parsed.recommendationId,
        actorId: userId,
        action: "validation_status_change",
        detail: { status: parsed.status },
      },
    });

    revalidate();
    return ok(undefined);
  } catch (err) {
    logSafeError("updateValidationStatus", err);
    return fail(safeErrorMessage(err, "Failed to update validation status"));
  }
}

/**
 * Phase 4: edit an AI-generated recommendation narrative. Preserves the model's
 * original copy the first time and marks the review edited. Does not change
 * approval status (editing published copy keeps it published).
 */
export async function updateRecommendationNarrative(
  input: NarrativeEditInput
): Promise<ActionResult<void>> {
  try {
    const { userId } = await requireAdvisorRole();
    const parsed = narrativeEditSchema.parse(input);

    const owns = await verifyAdvisorOwnsRecommendation(userId, parsed.recommendationId);
    if (!owns) return fail("Recommendation not found or not authorized");

    const rec = await prisma.assessmentRecommendation.findUnique({
      where: { id: parsed.recommendationId },
      select: { customization: true },
    });
    const customization = (rec?.customization as Record<string, unknown> | null) ?? {};
    const current = customization.aiNarrative as EditableNarrative | undefined;
    if (!current) return fail("No AI narrative to edit");

    const review = parseReview(customization.aiNarrativeReview);
    const { narrative, review: nextReview } = applyNarrativeEdit(current, review, {
      headline: parsed.headline,
      rationale: parsed.rationale,
      tailoredActions: parsed.tailoredActions,
    });

    await prisma.assessmentRecommendation.update({
      where: { id: parsed.recommendationId },
      data: {
        customization: {
          ...customization,
          aiNarrative: { ...current, ...narrative },
          aiNarrativeReview: nextReview,
        } as Prisma.InputJsonValue,
      },
    });

    await prisma.solutionActivity.create({
      data: {
        assessmentRecommendationId: parsed.recommendationId,
        actorId: userId,
        action: "narrative_edited",
        detail: { edited: true },
      },
    });

    revalidate();
    return ok(undefined);
  } catch (err) {
    logSafeError("updateRecommendationNarrative", err);
    return fail(safeErrorMessage(err, "Failed to update narrative"));
  }
}

/**
 * Phase 4: approve (or un-approve) an AI narrative. Only an approved narrative is
 * shown to the client.
 */
export async function setNarrativeApproval(
  input: NarrativeApprovalInput
): Promise<ActionResult<void>> {
  try {
    const { userId } = await requireAdvisorRole();
    const parsed = narrativeApprovalSchema.parse(input);

    const owns = await verifyAdvisorOwnsRecommendation(userId, parsed.recommendationId);
    if (!owns) return fail("Recommendation not found or not authorized");

    const rec = await prisma.assessmentRecommendation.findUnique({
      where: { id: parsed.recommendationId },
      select: { customization: true },
    });
    const customization = (rec?.customization as Record<string, unknown> | null) ?? {};
    if (!customization.aiNarrative) return fail("No AI narrative to approve");

    const review = parseReview(customization.aiNarrativeReview);
    const nextReview = parsed.approved
      ? approveNarrative(review, userId, new Date().toISOString())
      : unapproveNarrative(review);

    await prisma.assessmentRecommendation.update({
      where: { id: parsed.recommendationId },
      data: {
        customization: {
          ...customization,
          aiNarrativeReview: nextReview,
        } as Prisma.InputJsonValue,
      },
    });

    await prisma.solutionActivity.create({
      data: {
        assessmentRecommendationId: parsed.recommendationId,
        actorId: userId,
        action: parsed.approved ? "narrative_approved" : "narrative_unapproved",
        detail: { approved: parsed.approved },
      },
    });

    revalidate();
    return ok(undefined);
  } catch (err) {
    logSafeError("setNarrativeApproval", err);
    return fail(safeErrorMessage(err, "Failed to update narrative approval"));
  }
}

/**
 * Update time horizon for SAP grouping.
 */
export async function updateTimeHorizon(
  input: UpdateTimeHorizonInput
): Promise<ActionResult<void>> {
  try {
    const { userId } = await requireAdvisorRole();
    const parsed = updateTimeHorizonSchema.parse(input);

    const owns = await verifyAdvisorOwnsRecommendation(userId, parsed.recommendationId);
    if (!owns) return fail("Recommendation not found or not authorized");

    await prisma.assessmentRecommendation.update({
      where: { id: parsed.recommendationId },
      data: { timeHorizon: parsed.timeHorizon },
    });

    revalidate();
    return ok(undefined);
  } catch (err) {
    logSafeError("updateTimeHorizon", err);
    return fail(safeErrorMessage(err, "Failed to update time horizon"));
  }
}

/**
 * Update responsible roles for a recommendation.
 */
export async function updateResponsibleRoles(
  input: UpdateRolesInput
): Promise<ActionResult<void>> {
  try {
    const { userId } = await requireAdvisorRole();
    const parsed = updateRolesSchema.parse(input);

    const owns = await verifyAdvisorOwnsRecommendation(userId, parsed.recommendationId);
    if (!owns) return fail("Recommendation not found or not authorized");

    await prisma.assessmentRecommendation.update({
      where: { id: parsed.recommendationId },
      data: { responsibleRoles: parsed.roles },
    });

    revalidate();
    return ok(undefined);
  } catch (err) {
    logSafeError("updateResponsibleRoles", err);
    return fail(safeErrorMessage(err, "Failed to update responsible roles"));
  }
}

/**
 * Update assignees for a recommendation.
 */
export async function updateAssignees(
  input: UpdateAssigneesInput
): Promise<ActionResult<void>> {
  try {
    const { userId } = await requireAdvisorRole();
    const parsed = updateAssigneesSchema.parse(input);

    const owns = await verifyAdvisorOwnsRecommendation(userId, parsed.recommendationId);
    if (!owns) return fail("Recommendation not found or not authorized");

    await prisma.assessmentRecommendation.update({
      where: { id: parsed.recommendationId },
      data: { assignees: parsed.assignees as unknown as Prisma.InputJsonValue },
    });

    revalidate();
    return ok(undefined);
  } catch (err) {
    logSafeError("updateAssignees", err);
    return fail(safeErrorMessage(err, "Failed to update assignees"));
  }
}
