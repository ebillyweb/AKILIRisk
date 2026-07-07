"use server";

/**
 * Server actions for Phase 23 engagement tracking:
 * milestone status management, block/defer, and action plan publishing.
 *
 * All actions require advisor role and verify ownership of the
 * recommendation/assessment via clientAdvisorAssignment.
 */

import { revalidatePath } from "next/cache";
import { requireAdvisorRole } from "@/lib/advisor/auth";
import { assertAdvisorCanManageActionPlan } from "@/lib/enterprise/advisor-member-visibility";
import { prisma } from "@/lib/db";
import { logSafeError, safeErrorMessage } from "@/lib/log-safe-error";
import { updateMilestoneStatus } from "@/lib/recommendations/solution-lifecycle";
import { publishActionPlan } from "@/lib/engagement/publish-action-plan";
import {
  milestoneBlockSchema,
  milestoneDeferSchema,
  publishActionPlanSchema,
  milestoneStatusSchema,
  type MilestoneBlockInput,
  type MilestoneDeferInput,
  type PublishActionPlanInput,
  type MilestoneStatusInput,
} from "./guidance-schemas";

// ── Types ────────────────────────────────────────────────────────────────

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

function fail(error: string): ActionResult<never> {
  return { success: false, error };
}

function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

function revalidate() {
  revalidatePath("/advisor");
  revalidatePath("/dashboard/action-plan");
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Verify the advisor owns the milestone's recommendation via assignment.
 */
async function verifyMilestoneOwnership(
  milestoneId: string,
  userId: string
): Promise<{ valid: boolean; error?: string }> {
  const milestone = await prisma.solutionMilestone.findUnique({
    where: { id: milestoneId },
    select: {
      assessmentRecommendation: {
        select: {
          assessment: {
            select: {
              userId: true,
            },
          },
        },
      },
    },
  });

  if (!milestone) {
    return { valid: false, error: "Milestone not found" };
  }

  const clientId = milestone.assessmentRecommendation.assessment.userId;

  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: {
      clientId,
      advisor: { userId },
      status: "ACTIVE",
    },
  });

  if (!assignment) {
    return { valid: false, error: "Not authorized to manage this milestone" };
  }

  return { valid: true };
}

/**
 * Verify the advisor owns the assessment's client via assignment.
 */
async function verifyAssessmentOwnership(
  assessmentId: string,
  userId: string
): Promise<{ valid: boolean; error?: string }> {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { userId: true },
  });

  if (!assessment) {
    return { valid: false, error: "Assessment not found" };
  }

  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: {
      clientId: assessment.userId,
      advisor: { userId },
      status: "ACTIVE",
    },
  });

  if (!assignment) {
    return { valid: false, error: "Not authorized to manage this assessment" };
  }

  return { valid: true };
}

// ── Server Actions ───────────────────────────────────────────────────────

/**
 * Update milestone status (non-dialog statuses: NOT_STARTED, IN_PROGRESS, COMPLETED, SKIPPED).
 * Advisor-only per D-10.
 */
export async function updateMilestoneStatusAction(
  input: MilestoneStatusInput
): Promise<ActionResult<void>> {
  try {
    const { userId } = await requireAdvisorRole();
    const parsed = milestoneStatusSchema.parse(input);

    const ownership = await verifyMilestoneOwnership(parsed.milestoneId, userId);
    if (!ownership.valid) return fail(ownership.error!);

    await updateMilestoneStatus({
      milestoneId: parsed.milestoneId,
      status: parsed.status,
      actorId: userId,
    });

    revalidate();
    return ok(undefined);
  } catch (err) {
    logSafeError("updateMilestoneStatusAction", err);
    return fail(safeErrorMessage(err, "Failed to update milestone status"));
  }
}

/**
 * Block a milestone with a required reason. Advisor-only per D-11.
 */
export async function blockMilestone(
  input: MilestoneBlockInput
): Promise<ActionResult<void>> {
  try {
    const { userId } = await requireAdvisorRole();
    const parsed = milestoneBlockSchema.parse(input);

    const ownership = await verifyMilestoneOwnership(parsed.milestoneId, userId);
    if (!ownership.valid) return fail(ownership.error!);

    await updateMilestoneStatus({
      milestoneId: parsed.milestoneId,
      status: "BLOCKED",
      actorId: userId,
      reason: parsed.reason,
    });

    revalidate();
    return ok(undefined);
  } catch (err) {
    logSafeError("blockMilestone", err);
    return fail(safeErrorMessage(err, "Failed to block milestone"));
  }
}

/**
 * Defer a milestone with reason and optional revisit date. Advisor-only per D-11.
 */
export async function deferMilestone(
  input: MilestoneDeferInput
): Promise<ActionResult<void>> {
  try {
    const { userId } = await requireAdvisorRole();
    const parsed = milestoneDeferSchema.parse(input);

    const ownership = await verifyMilestoneOwnership(parsed.milestoneId, userId);
    if (!ownership.valid) return fail(ownership.error!);

    await updateMilestoneStatus({
      milestoneId: parsed.milestoneId,
      status: "DEFERRED",
      actorId: userId,
      reason: parsed.reason,
      revisitDate: parsed.revisitDate ? new Date(parsed.revisitDate) : undefined,
    });

    revalidate();
    return ok(undefined);
  } catch (err) {
    logSafeError("deferMilestone", err);
    return fail(safeErrorMessage(err, "Failed to defer milestone"));
  }
}

/**
 * Publish a client's action plan. Advisor-only per D-02, D-03.
 * Sets actionPlanPublishedAt and logs activity for each visible recommendation.
 */
export async function publishActionPlanAction(
  input: PublishActionPlanInput
): Promise<ActionResult<void>> {
  try {
    const { userId } = await requireAdvisorRole();
    await assertAdvisorCanManageActionPlan(userId);
    const parsed = publishActionPlanSchema.parse(input);

    const ownership = await verifyAssessmentOwnership(parsed.assessmentId, userId);
    if (!ownership.valid) return fail(ownership.error!);

    await publishActionPlan({
      assessmentId: parsed.assessmentId,
      actorId: userId,
    });

    revalidate();
    return ok(undefined);
  } catch (err) {
    logSafeError("publishActionPlanAction", err);
    return fail(safeErrorMessage(err, "Failed to publish action plan"));
  }
}
