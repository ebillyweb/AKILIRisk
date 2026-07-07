"use server";

/**
 * Server actions for Phase 24 reassessment flow:
 * start reassessment, view score deltas, targeted question count, and history.
 *
 * - startReassessmentAction: advisor-only (creates linked assessment)
 * - getScoreDeltasAction: advisor OR client (D-07)
 * - getTargetedQuestionCountAction: advisor OR client
 * - getReassessmentHistoryAction: advisor OR client
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdvisorRole } from "@/lib/advisor/auth";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logSafeError, safeErrorMessage } from "@/lib/log-safe-error";
import {
  createReassessment,
  getReassessmentChain,
} from "@/lib/assessment/reassessment";
import type {
  PillarDelta,
  ReassessmentChainEntry,
} from "@/lib/assessment/reassessment-types";
import { getScoreDeltasForAssessment } from "@/lib/analytics/score-delta";
import {
  getTargetedFollowupQuestions,
  getTargetedQuestionCount,
} from "@/lib/assessment/targeted-followup";
import {
  INTELLIGENCE_ACTIONS,
  logIntelligenceEvent,
} from "@/lib/engagement/intelligence-events";

// -- Types ------------------------------------------------------------------

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

function fail(error: string): ActionResult<never> {
  return { success: false, error };
}

function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

// -- Zod schemas ------------------------------------------------------------

const startReassessmentSchema = z.object({
  previousAssessmentId: z.string().cuid(),
  type: z.enum(["full", "pillar", "targeted"]),
  includedPillars: z.array(z.string()).optional(),
});

// -- Helpers ----------------------------------------------------------------

/**
 * Verify that a user (advisor or client) has access to an assessment.
 * - ADVISOR: check ClientAdvisorAssignment exists between advisor and assessment owner
 * - USER (client): check assessment.userId matches session userId
 * Per D-07, both roles can view deltas.
 */
async function verifyAssessmentAccess(
  assessmentId: string,
  userId: string,
  role: string,
): Promise<{ valid: boolean; error?: string; assessment?: { userId: string; previousAssessmentId: string | null } }> {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { userId: true, previousAssessmentId: true },
  });

  if (!assessment) {
    return { valid: false, error: "Assessment not found" };
  }

  if (role === "USER") {
    // Client can only access their own assessments
    if (assessment.userId !== userId) {
      return { valid: false, error: "Not authorized to access this assessment" };
    }
    return { valid: true, assessment };
  }

  // ADVISOR / ADMIN / SUPER_ADMIN: check assignment
  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: {
      clientId: assessment.userId,
      advisor: { userId },
      status: "ACTIVE",
    },
  });

  if (!assignment) {
    return { valid: false, error: "Not authorized to access this assessment" };
  }

  return { valid: true, assessment };
}

// -- Server Actions ---------------------------------------------------------

/**
 * Start a reassessment linked to a previous assessment.
 * Advisor-only: advisor initiates reassessment for their client.
 */
export async function startReassessmentAction(
  input: z.infer<typeof startReassessmentSchema>,
): Promise<ActionResult<{ id: string; version: number }>> {
  try {
    const { userId } = await requireAdvisorRole();
    const parsed = startReassessmentSchema.parse(input);

    // Verify advisor owns the client's assessment
    const access = await verifyAssessmentAccess(
      parsed.previousAssessmentId,
      userId,
      "ADVISOR",
    );
    if (!access.valid) return fail(access.error!);

    // Load previous assessment to get userId
    const previous = await prisma.assessment.findUniqueOrThrow({
      where: { id: parsed.previousAssessmentId },
      select: { userId: true },
    });

    // For targeted type, get question IDs from completed recommendations
    let targetedQuestionIds: string[] | undefined;
    if (parsed.type === "targeted") {
      targetedQuestionIds = await getTargetedFollowupQuestions(
        parsed.previousAssessmentId,
      );
    }

    const result = await createReassessment({
      userId: previous.userId,
      previousAssessmentId: parsed.previousAssessmentId,
      type: parsed.type,
      includedPillars: parsed.includedPillars,
      targetedQuestionIds,
    });

    // Log intelligence event
    await logIntelligenceEvent({
      action: INTELLIGENCE_ACTIONS.REASSESSMENT_TRIGGERED,
      assessmentId: result.id,
      actorId: userId,
      detail: {
        previousAssessmentId: parsed.previousAssessmentId,
        type: parsed.type,
        version: result.version,
      },
    });

    revalidatePath("/advisor");
    return ok(result);
  } catch (err) {
    logSafeError("startReassessmentAction", err);
    return fail(safeErrorMessage(err, "Failed to start reassessment"));
  }
}

/**
 * Get per-pillar score deltas between an assessment and its predecessor.
 * Accessible to both ADVISOR and USER (client) per D-07.
 */
export async function getScoreDeltasAction(
  assessmentId: string,
): Promise<ActionResult<PillarDelta[]>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return fail("Not authenticated");

    const role = session.user.role?.toString().toUpperCase() ?? "USER";
    const access = await verifyAssessmentAccess(assessmentId, session.user.id, role);
    if (!access.valid) return fail(access.error!);

    if (!access.assessment?.previousAssessmentId) {
      return fail("Assessment has no previous assessment for comparison");
    }

    const deltas = await getScoreDeltasForAssessment(
      assessmentId,
      access.assessment.previousAssessmentId,
    );

    return ok(deltas);
  } catch (err) {
    logSafeError("getScoreDeltasAction", err);
    return fail(safeErrorMessage(err, "Failed to get score deltas"));
  }
}

/**
 * Get count of eligible targeted follow-up questions for an assessment.
 * Accessible to both ADVISOR and USER (client).
 */
export async function getTargetedQuestionCountAction(
  assessmentId: string,
): Promise<ActionResult<number>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return fail("Not authenticated");

    const role = session.user.role?.toString().toUpperCase() ?? "USER";
    const access = await verifyAssessmentAccess(assessmentId, session.user.id, role);
    if (!access.valid) return fail(access.error!);

    const count = await getTargetedQuestionCount(assessmentId);
    return ok(count);
  } catch (err) {
    logSafeError("getTargetedQuestionCountAction", err);
    return fail(
      safeErrorMessage(err, "Failed to get targeted question count"),
    );
  }
}

/**
 * Get the reassessment chain (version history) for a user's assessments.
 * Accessible to both ADVISOR and USER (client).
 */
export async function getReassessmentHistoryAction(
  userId: string,
): Promise<ActionResult<ReassessmentChainEntry[]>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return fail("Not authenticated");

    const role = session.user.role?.toString().toUpperCase() ?? "USER";

    // For client: verify they are requesting their own history
    if (role === "USER" && userId !== session.user.id) {
      return fail("Not authorized to access this user's history");
    }

    // For advisor: verify they have an assignment with this client
    if (role !== "USER") {
      const assignment = await prisma.clientAdvisorAssignment.findFirst({
        where: {
          clientId: userId,
          advisor: { userId: session.user.id },
          status: "ACTIVE",
        },
      });
      if (!assignment) {
        return fail("Not authorized to access this user's history");
      }
    }

    // Get the latest completed assessment to start the chain
    const latest = await prisma.assessment.findFirst({
      where: { userId, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      select: { id: true },
    });

    if (!latest) {
      return ok([]);
    }

    const chain = await getReassessmentChain(latest.id);
    return ok(chain);
  } catch (err) {
    logSafeError("getReassessmentHistoryAction", err);
    return fail(safeErrorMessage(err, "Failed to get reassessment history"));
  }
}
