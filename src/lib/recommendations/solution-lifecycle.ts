import "server-only";

import type { Prisma } from "@prisma/client";
import type { RecommendationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  composeSolution,
  type ComposedSolution,
} from "@/lib/recommendations/compose-solution";

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

const ALLOWED_TRANSITIONS: Record<RecommendationStatus, RecommendationStatus[]> = {
  // Legacy states (kept for backward compat)
  PENDING: ["REVIEWED", "DECLINED", "GENERATED"],
  REVIEWED: ["ACCEPTED", "DECLINED", "INCLUDED", "DEFERRED"],
  ACCEPTED: ["COMPLETED"],
  DECLINED: [],
  COMPLETED: [],
  // Phase 22: implementation-focused lifecycle states
  GENERATED: ["REVIEWED", "INCLUDED", "DEFERRED"],
  INCLUDED: ["IN_PROGRESS", "DEFERRED"],
  DEFERRED: ["REVIEWED"],
  IN_PROGRESS: ["COMPLETED"],
};

export class InvalidTransitionError extends Error {
  constructor(from: RecommendationStatus, to: RecommendationStatus) {
    super(`Cannot transition from ${from} to ${to}`);
    this.name = "InvalidTransitionError";
  }
}

// ---------------------------------------------------------------------------
// Activity action constants
// ---------------------------------------------------------------------------

export const SOLUTION_ACTIONS = {
  STATUS_PENDING: "status_pending",
  STATUS_REVIEWED: "status_reviewed",
  STATUS_ACCEPTED: "status_accepted",
  STATUS_DECLINED: "status_declined",
  STATUS_COMPLETED: "status_completed",
  // Phase 22 new states
  STATUS_GENERATED: "status_generated",
  STATUS_INCLUDED: "status_included",
  STATUS_DEFERRED: "status_deferred",
  STATUS_IN_PROGRESS: "status_in_progress",
  MILESTONE_UPDATE: "milestone_update",
  // Phase 23: engagement tracking
  AUTO_COMPLETED: "auto_completed",
  MILESTONE_BLOCKED: "milestone_blocked",
  MILESTONE_DEFERRED: "milestone_deferred",
} as const;

const STATUS_ACTION_MAP: Record<RecommendationStatus, string> = {
  PENDING: SOLUTION_ACTIONS.STATUS_PENDING,
  REVIEWED: SOLUTION_ACTIONS.STATUS_REVIEWED,
  ACCEPTED: SOLUTION_ACTIONS.STATUS_ACCEPTED,
  DECLINED: SOLUTION_ACTIONS.STATUS_DECLINED,
  COMPLETED: SOLUTION_ACTIONS.STATUS_COMPLETED,
  GENERATED: SOLUTION_ACTIONS.STATUS_GENERATED,
  INCLUDED: SOLUTION_ACTIONS.STATUS_INCLUDED,
  DEFERRED: SOLUTION_ACTIONS.STATUS_DEFERRED,
  IN_PROGRESS: SOLUTION_ACTIONS.STATUS_IN_PROGRESS,
};

// ---------------------------------------------------------------------------
// Transaction client type
// ---------------------------------------------------------------------------

type TxClient = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Core transition
// ---------------------------------------------------------------------------

/**
 * Transition an AssessmentRecommendation to a new status.
 *
 * Validates against the state machine, updates lifecycle timestamps,
 * logs an activity entry, persists sourceLayerSummary, and hydrates
 * milestones on ACCEPTED. All within a single transaction.
 */
export async function transitionRecommendationStatus(input: {
  recommendationId: string;
  newStatus: RecommendationStatus;
  actorId: string;
  reason?: string;
  notes?: string;
  deferredRevisitDate?: Date;
  deferredTriggerEvent?: string;
}): Promise<void> {
  const { recommendationId, newStatus, actorId, reason, notes,
    deferredRevisitDate, deferredTriggerEvent } = input;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Read current status for state machine validation
    const current = await tx.assessmentRecommendation.findUniqueOrThrow({
      where: { id: recommendationId },
      select: { status: true },
    });

    const allowed = ALLOWED_TRANSITIONS[current.status];
    if (!allowed.includes(newStatus)) {
      throw new InvalidTransitionError(current.status, newStatus);
    }

    // Build lifecycle timestamp fields
    const data: Record<string, unknown> = {
      status: newStatus,
      statusUpdatedAt: now,
    };

    switch (newStatus) {
      case "ACCEPTED":
        data.acceptedAt = now;
        break;
      case "DECLINED":
        data.declinedAt = now;
        if (reason) data.declinedReason = reason;
        break;
      case "COMPLETED":
        data.completedAt = now;
        break;
      case "INCLUDED":
        data.acceptedAt = now;
        break;
      case "DEFERRED":
        if (reason) data.deferredReason = reason;
        if (deferredRevisitDate) data.deferredRevisitDate = deferredRevisitDate;
        if (deferredTriggerEvent) data.deferredTriggerEvent = deferredTriggerEvent;
        break;
      case "IN_PROGRESS":
        data.startedAt = now;
        break;
    }

    if (notes) {
      data.implementationNotes = notes;
    }

    // On ACCEPTED or INCLUDED, compose the solution and persist sourceLayerSummary
    if (newStatus === "ACCEPTED" || newStatus === "INCLUDED") {
      const composed = await composeWithinTransaction(tx, recommendationId);
      if (composed) {
        data.sourceLayerSummary = composed.sourceLayer;
      }
    }

    await tx.assessmentRecommendation.update({
      where: { id: recommendationId },
      data,
    });

    // Log activity with from/to
    await tx.solutionActivity.create({
      data: {
        assessmentRecommendationId: recommendationId,
        actorId,
        action: STATUS_ACTION_MAP[newStatus],
        detail: {
          from: current.status,
          to: newStatus,
          ...(reason ? { reason } : {}),
        },
      },
    });

    // Hydrate milestones on ACCEPTED or INCLUDED (uses tx, not global prisma)
    if (newStatus === "ACCEPTED" || newStatus === "INCLUDED") {
      await hydrateMilestones(tx, recommendationId);
    }
  });
}

// ---------------------------------------------------------------------------
// Milestone hydration (transaction-safe)
// ---------------------------------------------------------------------------

/**
 * Compose a solution using the transaction client so reads are
 * consistent with the transaction isolation level.
 */
async function composeWithinTransaction(
  tx: TxClient,
  recommendationId: string
): Promise<ComposedSolution | null> {
  const rec = await tx.assessmentRecommendation.findUnique({
    where: { id: recommendationId },
    include: {
      serviceRecommendation: true,
      assessment: { select: { userId: true } },
    },
  });
  if (!rec) return null;

  const assignment = await tx.clientAdvisorAssignment.findFirst({
    where: { clientId: rec.assessment.userId, status: "ACTIVE" },
    select: {
      advisor: {
        select: {
          id: true,
          firmName: true,
          enterpriseId: true,
          enterprise: { select: { id: true, name: true } },
        },
      },
    },
  });

  const advisorProfile = assignment?.advisor ?? null;
  const enterprise = advisorProfile?.enterprise ?? null;

  const [ec, ac] = await Promise.all([
    enterprise
      ? tx.enterpriseSolutionCustomization.findUnique({
          where: {
            enterpriseId_serviceRecommendationId: {
              enterpriseId: enterprise.id,
              serviceRecommendationId: rec.serviceRecommendationId,
            },
          },
        })
      : null,
    advisorProfile
      ? tx.advisorSolutionCustomization.findUnique({
          where: {
            advisorProfileId_serviceRecommendationId: {
              advisorProfileId: advisorProfile.id,
              serviceRecommendationId: rec.serviceRecommendationId,
            },
          },
        })
      : null,
  ]);

  return composeSolution({
    service: rec.serviceRecommendation,
    enterpriseCustomization: ec,
    advisorCustomization: ac,
    enterpriseName: enterprise?.name,
    advisorName: advisorProfile?.firmName,
  });
}

/**
 * Materialize composed playbook steps as SolutionMilestone rows.
 * Only runs when no milestones exist yet (idempotent).
 */
async function hydrateMilestones(
  tx: TxClient,
  recommendationId: string
): Promise<void> {
  const existingCount = await tx.solutionMilestone.count({
    where: { assessmentRecommendationId: recommendationId },
  });
  if (existingCount > 0) return;

  const composed = await composeWithinTransaction(tx, recommendationId);
  if (!composed || composed.playbook.length === 0) return;

  await tx.solutionMilestone.createMany({
    data: composed.playbook.map((step, idx) => ({
      assessmentRecommendationId: recommendationId,
      title: step.title,
      description: step.description ?? null,
      estimatedDuration: step.estimatedDuration ?? null,
      sortOrder: idx,
      source: step.source,
    })),
  });
}

// ---------------------------------------------------------------------------
// Milestone status update
// ---------------------------------------------------------------------------

/**
 * Update a single milestone's status (transactional with activity log).
 * Phase 23: supports BLOCKED/DEFERRED with reason fields and auto-completion.
 */
export async function updateMilestoneStatus(input: {
  milestoneId: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED" | "BLOCKED" | "DEFERRED";
  actorId: string;
  reason?: string;
  revisitDate?: Date;
}): Promise<void> {
  const { milestoneId, status, actorId, reason, revisitDate } = input;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Build update data based on target status
    const data: Record<string, unknown> = {
      status,
      completedAt: status === "COMPLETED" ? now : null,
    };

    if (status === "BLOCKED") {
      data.blockedReason = reason ?? null;
      data.deferredReason = null;
      data.deferredRevisitDate = null;
    } else if (status === "DEFERRED") {
      data.deferredReason = reason ?? null;
      data.deferredRevisitDate = revisitDate ?? null;
      data.blockedReason = null;
    } else {
      // Transitioning away from BLOCKED/DEFERRED -- clear reason fields
      data.blockedReason = null;
      data.deferredReason = null;
      data.deferredRevisitDate = null;
    }

    const milestone = await tx.solutionMilestone.update({
      where: { id: milestoneId },
      data,
    });

    // Determine activity action
    let action: string = SOLUTION_ACTIONS.MILESTONE_UPDATE;
    if (status === "BLOCKED") action = SOLUTION_ACTIONS.MILESTONE_BLOCKED;
    if (status === "DEFERRED") action = SOLUTION_ACTIONS.MILESTONE_DEFERRED;

    await tx.solutionActivity.create({
      data: {
        assessmentRecommendationId: milestone.assessmentRecommendationId,
        actorId,
        action,
        detail: {
          milestoneId,
          title: milestone.title,
          status,
          ...(reason ? { reason } : {}),
          ...(revisitDate ? { revisitDate: revisitDate.toISOString() } : {}),
        },
      },
    });

    // Check auto-completion after every milestone status change
    await checkAutoCompletion(tx, milestone.assessmentRecommendationId, actorId);
  });
}

// ---------------------------------------------------------------------------
// Auto-completion detection (Phase 23)
// ---------------------------------------------------------------------------

const TERMINAL_MILESTONE_STATUSES = ["COMPLETED", "SKIPPED", "DEFERRED"];

/**
 * Check if all milestones for a recommendation have reached terminal status.
 * If so, auto-transition the parent recommendation to COMPLETED.
 * A BLOCKED milestone prevents auto-completion.
 */
async function checkAutoCompletion(
  tx: TxClient,
  recommendationId: string,
  actorId: string,
): Promise<void> {
  const milestones = await tx.solutionMilestone.findMany({
    where: { assessmentRecommendationId: recommendationId },
    select: { status: true },
  });

  // No milestones = nothing to auto-complete
  if (milestones.length === 0) return;

  // Any BLOCKED milestone prevents auto-completion
  if (milestones.some((m) => m.status === "BLOCKED")) return;

  // All must be in terminal status
  const allTerminal = milestones.every((m) =>
    TERMINAL_MILESTONE_STATUSES.includes(m.status),
  );
  if (!allTerminal) return;

  // Check current recommendation status -- only auto-complete from IN_PROGRESS
  const rec = await tx.assessmentRecommendation.findUnique({
    where: { id: recommendationId },
    select: { status: true },
  });
  if (!rec || rec.status !== "IN_PROGRESS") return;

  const now = new Date();
  await tx.assessmentRecommendation.update({
    where: { id: recommendationId },
    data: {
      status: "COMPLETED",
      completedAt: now,
      statusUpdatedAt: now,
    },
  });

  await tx.solutionActivity.create({
    data: {
      assessmentRecommendationId: recommendationId,
      actorId,
      action: SOLUTION_ACTIONS.AUTO_COMPLETED,
      detail: { reason: "all_milestones_terminal" },
    },
  });
}
