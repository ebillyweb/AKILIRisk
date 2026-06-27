"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaskStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "WAITING"
  | "READY_FOR_REVIEW"
  | "COMPLETED";

export type ValidationStatus =
  | "PENDING_REVIEW"
  | "VERIFIED"
  | "NEEDS_FOLLOWUP";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export type PlaybookStep = {
  title: string;
  description: string;
  estimatedDuration?: string;
  source?: "PLATFORM" | "ENTERPRISE" | "ADVISOR";
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
  triggerReason: string;
  mergedEvidence: string | null;
  playbookSteps: PlaybookStep[];
  taskStatus: TaskStatus;
  validationStatus: ValidationStatus | null;
  requiresValidation: boolean;
  responsibleRoles: string[];
  assignees: string[];
  urgencyScore: number;
  timeHorizon: "immediate" | "strategic" | "ongoing";
  deferredRevisitDate: string | null;
};

export type ClientActionPlanData = {
  immediate: ActionPlanItem[];
  strategic: ActionPlanItem[];
  ongoing: ActionPlanItem[];
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function updateTaskStatus(input: {
  recommendationId: string;
  taskStatus: TaskStatus;
}): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    // Find the recommendation and verify ownership
    const rec = await prisma.assessmentRecommendation.findUnique({
      where: { id: input.recommendationId },
      include: { assessment: { select: { userId: true } } },
    });

    if (!rec) {
      return { success: false, error: "Recommendation not found" };
    }

    if (rec.assessment.userId !== session.user.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Update the task status via customization JSON field
    const existing =
      (rec.customization as Record<string, unknown>) ?? {};
    await prisma.assessmentRecommendation.update({
      where: { id: input.recommendationId },
      data: {
        customization: {
          ...existing,
          taskStatus: input.taskStatus,
        },
      },
    });

    revalidatePath("/dashboard/action-plan");
    return { success: true, data: undefined };
  } catch (_err) {
    return { success: false, error: "Failed to update task status" };
  }
}

export async function getClientActionPlan(): Promise<
  ActionResult<ClientActionPlanData>
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    // Find all completed assessments for this client
    const assessments = await prisma.assessment.findMany({
      where: {
        userId: session.user.id,
        status: "COMPLETED",
        recommendations: { some: {} },
      },
      include: {
        recommendations: {
          where: {
            status: { in: ["ACCEPTED", "PENDING", "REVIEWED"] },
          },
          orderBy: { priority: "asc" },
          include: {
            serviceRecommendation: {
              select: {
                id: true,
                name: true,
                description: true,
                category: true,
                estimatedCost: true,
                implementationType: true,
              },
            },
          },
        },
      },
      orderBy: { completedAt: "desc" },
    });

    // Deduplicate by serviceRecommendationId, keeping highest priority
    const dedupMap = new Map<
      string,
      (typeof assessments)[number]["recommendations"][number]
    >();
    for (const assessment of assessments) {
      for (const rec of assessment.recommendations) {
        const existing = dedupMap.get(rec.serviceRecommendationId);
        if (!existing || rec.priority < (existing.priority ?? 999)) {
          dedupMap.set(rec.serviceRecommendationId, rec);
        }
      }
    }

    const allRecs = Array.from(dedupMap.values());

    // Filter out hidden items
    const visibleRecs = allRecs.filter((rec) => {
      const cust = rec.customization as Record<string, unknown> | null;
      return !cust?.hiddenFromClient;
    });

    // Map to ActionPlanItem and group by timeHorizon
    const items: ActionPlanItem[] = visibleRecs.map((rec) => {
      const cust =
        (rec.customization as Record<string, unknown>) ?? {};
      const triggerData = rec.triggerReason as
        | Record<string, unknown>
        | string
        | null;
      const triggerText =
        typeof triggerData === "string"
          ? triggerData
          : triggerData
            ? JSON.stringify(triggerData)
            : "";

      return {
        id: rec.id,
        name: rec.serviceRecommendation.name,
        description: rec.serviceRecommendation.description ?? "",
        category: rec.serviceRecommendation.category ?? "",
        expectedOutcome: (cust.expectedOutcome as string) ?? null,
        estimatedCost:
          (cust.estimatedCost as string) ??
          rec.serviceRecommendation.estimatedCost ??
          null,
        timeframe: (cust.timeframe as string) ?? null,
        provider: (cust.provider as string) ?? null,
        triggerReason: triggerText,
        mergedEvidence: (cust.mergedEvidence as string) ?? null,
        playbookSteps: Array.isArray(cust.playbookSteps)
          ? (cust.playbookSteps as PlaybookStep[])
          : [],
        taskStatus:
          (cust.taskStatus as TaskStatus) ?? "NOT_STARTED",
        validationStatus:
          (cust.validationStatus as ValidationStatus) ?? null,
        requiresValidation:
          (cust.requiresValidation as boolean) ?? false,
        responsibleRoles: Array.isArray(cust.responsibleRoles)
          ? (cust.responsibleRoles as string[])
          : [],
        assignees: Array.isArray(cust.assignees)
          ? (cust.assignees as string[])
          : [],
        urgencyScore: rec.priority ?? 5,
        timeHorizon:
          (cust.timeHorizon as "immediate" | "strategic" | "ongoing") ??
          "immediate",
        deferredRevisitDate:
          (cust.deferredRevisitDate as string) ?? null,
      };
    });

    const grouped: ClientActionPlanData = {
      immediate: items
        .filter((i) => i.timeHorizon === "immediate")
        .sort((a, b) => a.urgencyScore - b.urgencyScore),
      strategic: items
        .filter((i) => i.timeHorizon === "strategic")
        .sort((a, b) => a.urgencyScore - b.urgencyScore),
      ongoing: items
        .filter((i) => i.timeHorizon === "ongoing")
        .sort((a, b) => a.urgencyScore - b.urgencyScore),
    };

    return { success: true, data: grouped };
  } catch (_err) {
    return { success: false, error: "Failed to load action plan" };
  }
}
