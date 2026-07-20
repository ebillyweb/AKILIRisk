"use server";

/**
 * Client action plan server actions.
 *
 * These actions use session-based auth (not requireAdvisorRole).
 * Task status is client-managed; validation status is NOT exposed here
 * (advisor-only in guidance-actions.ts, per T-22-09).
 */

import { revalidatePath } from "next/cache";
import { extractRecommendationReasons } from "@/lib/recommendations/format-trigger";
import { clientNarrative } from "@/lib/assessment/recommendations/llm-narrative/narrative-display";
import type { DisplayNarrative } from "@/lib/assessment/recommendations/llm-narrative/narrative-display";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { logSafeError, safeErrorMessage } from "@/lib/log-safe-error";
import {
  taskStatusSchema,
  type TaskStatusInput,
} from "./guidance-schemas";
import { getClientActivityFeed, type ActivityFeedItem } from "@/lib/engagement/activity-feed";
import { isTrackingActiveForAssessment } from "@/lib/engagement/feature-flags";
import type { MilestoneInfo } from "@/components/action-plan/NextStepCallout";

// ── Types ────────────────────────────────────────────────────────────────

export type TaskStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "WAITING"
  | "READY_FOR_REVIEW"
  | "COMPLETED";

export type PlaybookStep = {
  title: string;
  description: string;
  estimatedDuration?: string;
  source?: "PLATFORM" | "ENTERPRISE" | "ADVISOR";
};

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

export type MilestoneItem = {
  id: string;
  title: string;
  status: string;
  dueDate: Date | null;
  completedAt: Date | null;
};

export type ActionPlanItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  expectedOutcome: string | null;
  estimatedCost: string | null;
  timeframe: string | null;
  provider: string | null;
  /** @deprecated Prefer recommendationReasons; kept for legacy rows */
  triggerReason: string;
  /** @deprecated Prefer recommendationReasons */
  mergedEvidence: string | null;
  recommendationReasons: string[];
  playbookSteps: PlaybookStep[];
  taskStatus: TaskStatus;
  validationStatus: string | null;
  requiresValidation: boolean;
  responsibleRoles: string[];
  assignees: string[];
  urgencyScore: number;
  timeHorizon: "immediate" | "strategic" | "ongoing";
  deferredRevisitDate: string | null;
  milestones: MilestoneItem[];
  milestoneCompletionPct: number;
  /** AI-drafted narrative — present only when an advisor has approved it. */
  aiNarrative: DisplayNarrative | null;
};

export type ClientActionPlanData = {
  immediate: ActionPlanItem[];
  strategic: ActionPlanItem[];
  ongoing: ActionPlanItem[];
};

/**
 * Get the client's Strategic Action Plan.
 *
 * Returns all INCLUDED, IN_PROGRESS, or COMPLETED recommendations
 * where hiddenFromClient is false, grouped by timeHorizon.
 */
export async function getClientActionPlan(): Promise<
  ActionResult<ClientActionPlanData>
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
            expectedOutcome: true,
            estimatedCost: true,
            timeframe: true,
            provider: true,
          },
        },
        milestones: {
          select: {
            id: true,
            title: true,
            description: true,
            estimatedDuration: true,
            source: true,
            status: true,
            dueDate: true,
            completedAt: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: [{ urgencyScore: "desc" }, { priority: "asc" }],
    });

    // Map to ActionPlanItem
    const items: ActionPlanItem[] = recs.map((rec) => {
      const recommendationReasons = [
        ...extractRecommendationReasons(rec.triggerReason),
      ];
      const advisorNote = rec.advisorNotes?.trim();
      if (advisorNote && !recommendationReasons.includes(advisorNote)) {
        recommendationReasons.push(advisorNote);
      }

      const assigneesRaw = rec.assignees as
        | Array<{ name: string }>
        | null;
      const horizon = (rec.timeHorizon ?? "strategic") as
        | "immediate"
        | "strategic"
        | "ongoing";

      return {
        id: rec.id,
        name: rec.serviceRecommendation.name,
        description: rec.serviceRecommendation.description ?? "",
        category: rec.serviceRecommendation.category ?? "",
        expectedOutcome: rec.serviceRecommendation.expectedOutcome ?? null,
        estimatedCost: rec.serviceRecommendation.estimatedCost ?? null,
        timeframe: rec.serviceRecommendation.timeframe ?? null,
        provider: rec.serviceRecommendation.provider ?? null,
        triggerReason: recommendationReasons.join(" "),
        mergedEvidence: rec.advisorNotes,
        recommendationReasons,
        playbookSteps: rec.milestones.map((m) => ({
          title: m.title,
          description: m.description ?? "",
          estimatedDuration: m.estimatedDuration ?? undefined,
          source: (m.source ?? "PLATFORM") as PlaybookStep["source"],
        })),
        taskStatus: rec.taskStatus as TaskStatus,
        validationStatus: rec.validationStatus,
        requiresValidation: rec.requiresValidation,
        responsibleRoles: rec.responsibleRoles,
        assignees: assigneesRaw?.map((a) => a.name) ?? [],
        urgencyScore: rec.urgencyScore ?? 5,
        timeHorizon: horizon,
        deferredRevisitDate: rec.deferredRevisitDate?.toISOString() ?? null,
        milestones: rec.milestones.map((m) => ({
          id: m.id,
          title: m.title,
          status: m.status,
          dueDate: m.dueDate,
          completedAt: m.completedAt,
        })),
        milestoneCompletionPct:
          rec.milestones.length > 0
            ? Math.round(
                (rec.milestones.filter((m) =>
                  ["COMPLETED", "SKIPPED", "DEFERRED"].includes(m.status)
                ).length /
                  rec.milestones.length) *
                  100
              )
            : 0,
        // Client sees the AI narrative only once the advisor has approved it.
        aiNarrative: clientNarrative(rec.customization),
      };
    });

    const result: ClientActionPlanData = {
      immediate: items
        .filter((i) => i.timeHorizon === "immediate")
        .sort((a, b) => b.urgencyScore - a.urgencyScore),
      strategic: items
        .filter((i) => i.timeHorizon === "strategic")
        .sort((a, b) => b.urgencyScore - a.urgencyScore),
      ongoing: items
        .filter((i) => i.timeHorizon === "ongoing")
        .sort((a, b) => b.urgencyScore - a.urgencyScore),
    };

    return ok(result);
  } catch (err) {
    logSafeError("getClientActionPlan", err);
    return fail(safeErrorMessage(err, "Failed to load action plan"));
  }
}

// ── Tracking context ────────────────────────────────────────────────────

export type TrackingContext = {
  isTrackingActive: boolean;
  activities: ActivityFeedItem[];
  allMilestones: MilestoneInfo[];
};

/**
 * Get tracking context for the action plan page.
 * Returns inactive if the assessment's action plan is not published.
 */
export async function getActionPlanTrackingContext(): Promise<TrackingContext> {
  const inactive: TrackingContext = {
    isTrackingActive: false,
    activities: [],
    allMilestones: [],
  };

  try {
    const session = await auth();
    if (!session?.user?.id) return inactive;

    // Find the client's completed assessment
    const assessment = await prisma.assessment.findFirst({
      where: {
        userId: session.user.id,
        status: "COMPLETED",
      },
      select: { id: true },
      orderBy: { completedAt: "desc" },
    });

    if (!assessment) return inactive;

    const isActive = await isTrackingActiveForAssessment(assessment.id);
    if (!isActive) return inactive;

    // Load activities and milestones
    const [activities, milestones] = await Promise.all([
      getClientActivityFeed({
        clientId: session.user.id,
        role: "CLIENT",
        limit: 20,
      }),
      prisma.solutionMilestone.findMany({
        where: {
          assessmentRecommendation: {
            assessmentId: assessment.id,
            hiddenFromClient: false,
            status: { in: ["INCLUDED", "IN_PROGRESS", "COMPLETED"] },
          },
        },
        select: {
          title: true,
          status: true,
          dueDate: true,
          assessmentRecommendation: {
            select: {
              serviceRecommendation: { select: { name: true } },
            },
          },
        },
        orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }],
      }),
    ]);

    return {
      isTrackingActive: true,
      activities,
      allMilestones: milestones.map((m) => ({
        title: m.title,
        dueDate: m.dueDate,
        recommendationName:
          m.assessmentRecommendation.serviceRecommendation?.name ?? "Unknown",
      })),
    };
  } catch (err) {
    logSafeError("getActionPlanTrackingContext", err);
    return inactive;
  }
}
