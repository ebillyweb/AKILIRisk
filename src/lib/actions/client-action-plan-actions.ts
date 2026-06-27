"use server";

/**
 * Client action plan server actions.
 *
 * These actions use session-based auth (not requireAdvisorRole).
 * Task status is client-managed; validation status is NOT exposed here
 * (advisor-only in guidance-actions.ts, per T-22-09).
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { logSafeError, safeErrorMessage } from "@/lib/log-safe-error";
import {
  taskStatusSchema,
  type TaskStatusInput,
} from "./guidance-schemas";

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
  revalidatePath("/dashboard/action-plan");
}

// ── Client actions ───────────────────────────────────────────────────────

/**
 * Update task status on a recommendation.
 *
 * Verifies assessment.userId matches session.user.id (T-22-07).
 * If taskStatus is COMPLETED and requiresValidation is true,
 * creates a SolutionActivity with action "validation_requested".
 */
export async function updateTaskStatus(
  input: TaskStatusInput
): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return fail("Not authenticated");
    }

    const parsed = taskStatusSchema.parse(input);

    // Verify ownership: recommendation's assessment must belong to this client
    const rec = await prisma.assessmentRecommendation.findUnique({
      where: { id: parsed.recommendationId },
      select: {
        requiresValidation: true,
        assessment: { select: { userId: true } },
      },
    });

    if (!rec) {
      return fail("Recommendation not found");
    }

    if (rec.assessment.userId !== session.user.id) {
      return fail("Not authorized to update this recommendation");
    }

    await prisma.assessmentRecommendation.update({
      where: { id: parsed.recommendationId },
      data: { taskStatus: parsed.taskStatus },
    });

    // If completed and requires validation, create a validation request activity
    if (parsed.taskStatus === "COMPLETED" && rec.requiresValidation) {
      await prisma.solutionActivity.create({
        data: {
          assessmentRecommendationId: parsed.recommendationId,
          actorId: session.user.id,
          action: "validation_requested",
          detail: { taskStatus: parsed.taskStatus },
        },
      });
    }

    revalidate();
    return ok(undefined);
  } catch (err) {
    logSafeError("updateTaskStatus", err);
    return fail(safeErrorMessage(err, "Failed to update task status"));
  }
}

/**
 * Grouped action plan item for client display.
 */
export type ActionPlanItem = {
  id: string;
  serviceRecommendationId: string;
  serviceName: string;
  serviceDescription: string | null;
  serviceCategory: string | null;
  status: string;
  taskStatus: string;
  validationStatus: string;
  requiresValidation: boolean;
  advisorPriority: string | null;
  advisorNotes: string | null;
  urgencyScore: number | null;
  timeHorizon: string | null;
  responsibleRoles: string[];
  assignees: unknown;
  estimatedCost: string | null;
  timeframe: string | null;
  provider: string | null;
};

export type ActionPlanGroup = {
  timeHorizon: string;
  items: ActionPlanItem[];
};

/**
 * Get the client's Strategic Action Plan.
 *
 * Returns all INCLUDED, IN_PROGRESS, or COMPLETED recommendations
 * where hiddenFromClient is false, grouped by timeHorizon.
 */
export async function getClientActionPlan(): Promise<
  ActionResult<{ groups: ActionPlanGroup[] }>
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return fail("Not authenticated");
    }

    const recs = await prisma.assessmentRecommendation.findMany({
      where: {
        assessment: {
          userId: session.user.id,
          status: "COMPLETED",
        },
        status: { in: ["INCLUDED", "IN_PROGRESS", "COMPLETED"] },
        hiddenFromClient: false,
      },
      include: {
        serviceRecommendation: {
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            estimatedCost: true,
            timeframe: true,
            provider: true,
          },
        },
      },
      orderBy: [{ urgencyScore: "desc" }, { priority: "asc" }],
    });

    // Map to ActionPlanItem
    const items: ActionPlanItem[] = recs.map((rec) => ({
      id: rec.id,
      serviceRecommendationId: rec.serviceRecommendationId,
      serviceName: rec.serviceRecommendation.name,
      serviceDescription: rec.serviceRecommendation.description,
      serviceCategory: rec.serviceRecommendation.category,
      status: rec.status,
      taskStatus: rec.taskStatus,
      validationStatus: rec.validationStatus,
      requiresValidation: rec.requiresValidation,
      advisorPriority: rec.advisorPriority,
      advisorNotes: rec.advisorNotes,
      urgencyScore: rec.urgencyScore,
      timeHorizon: rec.timeHorizon,
      responsibleRoles: rec.responsibleRoles,
      assignees: rec.assignees,
      estimatedCost: rec.serviceRecommendation.estimatedCost,
      timeframe: rec.serviceRecommendation.timeframe,
      provider: rec.serviceRecommendation.provider,
    }));

    // Group by timeHorizon (null defaults to "strategic")
    const grouped = new Map<string, ActionPlanItem[]>();
    for (const item of items) {
      const horizon = item.timeHorizon ?? "strategic";
      if (!grouped.has(horizon)) grouped.set(horizon, []);
      grouped.get(horizon)!.push(item);
    }

    // Order: immediate, strategic, ongoing
    const horizonOrder = ["immediate", "strategic", "ongoing"];
    const groups: ActionPlanGroup[] = horizonOrder
      .filter((h) => grouped.has(h))
      .map((h) => ({ timeHorizon: h, items: grouped.get(h)! }));

    // Add any custom horizons not in the standard list
    for (const [horizon, groupItems] of grouped) {
      if (!horizonOrder.includes(horizon)) {
        groups.push({ timeHorizon: horizon, items: groupItems });
      }
    }

    return ok({ groups });
  } catch (err) {
    logSafeError("getClientActionPlan", err);
    return fail(safeErrorMessage(err, "Failed to load action plan"));
  }
}
