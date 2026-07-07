"use server";

/**
 * Server actions for Phase 24 review cadence management:
 * set, override, and query cadence for a client.
 *
 * All actions require advisor role and verify advisor-client assignment.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdvisorRole } from "@/lib/advisor/auth";
import { prisma } from "@/lib/db";
import { logSafeError, safeErrorMessage } from "@/lib/log-safe-error";
import {
  createOrUpdateCadence,
  getCadenceForClient,
  computeNextDueDate,
} from "@/lib/cadence/review-cadence";
import type { CadenceInfo } from "@/lib/cadence/cadence-types";
import { isCadenceEngineEnabled } from "@/lib/engagement/feature-flags";
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

const setCadenceSchema = z.object({
  clientId: z.string().cuid(),
  frequency: z.enum(["QUARTERLY", "SEMI_ANNUAL", "ANNUAL"]),
});

const overrideCadenceSchema = z.object({
  clientId: z.string().cuid(),
  frequency: z.enum(["QUARTERLY", "SEMI_ANNUAL", "ANNUAL"]),
});

// -- Helpers ----------------------------------------------------------------

/**
 * Verify the advisor has an active assignment with the client.
 * Returns the advisorProfileId on success.
 */
async function verifyAdvisorClientAssignment(
  clientId: string,
  advisorUserId: string,
): Promise<{ valid: boolean; error?: string; advisorProfileId?: string }> {
  const profile = await prisma.advisorProfile.findUnique({
    where: { userId: advisorUserId },
    select: { id: true },
  });

  if (!profile) {
    return { valid: false, error: "Advisor profile not found" };
  }

  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: {
      clientId,
      advisorId: profile.id,
      status: "ACTIVE",
    },
  });

  if (!assignment) {
    return { valid: false, error: "Not authorized to manage this client" };
  }

  return { valid: true, advisorProfileId: profile.id };
}

/**
 * Get the latest completed assessment date for computing nextDueDate.
 */
async function getLatestCompletedDate(
  clientId: string,
): Promise<Date | null> {
  const assessment = await prisma.assessment.findFirst({
    where: { userId: clientId, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    select: { completedAt: true },
  });

  return assessment?.completedAt ?? null;
}

// -- Server Actions ---------------------------------------------------------

/**
 * Set a review cadence for a client.
 * Advisor-only. Verifies advisor-client assignment and cadence engine enabled.
 */
export async function setCadenceAction(
  input: z.infer<typeof setCadenceSchema>,
): Promise<ActionResult<CadenceInfo>> {
  try {
    const { userId } = await requireAdvisorRole();
    const parsed = setCadenceSchema.parse(input);

    const assignment = await verifyAdvisorClientAssignment(
      parsed.clientId,
      userId,
    );
    if (!assignment.valid) return fail(assignment.error!);

    const enabled = await isCadenceEngineEnabled(assignment.advisorProfileId!);
    if (!enabled) {
      return fail("Cadence engine is not enabled for your organization");
    }

    // Compute nextDueDate from latest completed assessment
    const completedAt = await getLatestCompletedDate(parsed.clientId);
    const nextDueDate = completedAt
      ? computeNextDueDate(completedAt, parsed.frequency)
      : computeNextDueDate(new Date(), parsed.frequency);

    const cadence = await createOrUpdateCadence({
      clientId: parsed.clientId,
      advisorProfileId: assignment.advisorProfileId!,
      frequency: parsed.frequency,
      nextDueDate,
      isOverridden: false,
    });

    // Log intelligence event
    await logIntelligenceEvent({
      action: INTELLIGENCE_ACTIONS.CADENCE_CHANGED,
      actorId: userId,
      assessmentId: cadence.lastAssessmentId ?? undefined,
      detail: {
        clientId: parsed.clientId,
        frequency: parsed.frequency,
        isOverridden: false,
      },
    });

    revalidatePath("/advisor");
    return ok(cadence);
  } catch (err) {
    logSafeError("setCadenceAction", err);
    return fail(safeErrorMessage(err, "Failed to set cadence"));
  }
}

/**
 * Override a review cadence for a client (D-08: advisor manual override).
 * Advisor-only. Sets isOverridden=true.
 */
export async function overrideCadenceAction(
  input: z.infer<typeof overrideCadenceSchema>,
): Promise<ActionResult<CadenceInfo>> {
  try {
    const { userId } = await requireAdvisorRole();
    const parsed = overrideCadenceSchema.parse(input);

    const assignment = await verifyAdvisorClientAssignment(
      parsed.clientId,
      userId,
    );
    if (!assignment.valid) return fail(assignment.error!);

    // Compute nextDueDate from latest completed assessment
    const completedAt = await getLatestCompletedDate(parsed.clientId);
    const nextDueDate = completedAt
      ? computeNextDueDate(completedAt, parsed.frequency)
      : computeNextDueDate(new Date(), parsed.frequency);

    const cadence = await createOrUpdateCadence({
      clientId: parsed.clientId,
      advisorProfileId: assignment.advisorProfileId!,
      frequency: parsed.frequency,
      nextDueDate,
      isOverridden: true,
    });

    // Log intelligence event
    await logIntelligenceEvent({
      action: INTELLIGENCE_ACTIONS.CADENCE_CHANGED,
      actorId: userId,
      assessmentId: cadence.lastAssessmentId ?? undefined,
      detail: {
        clientId: parsed.clientId,
        frequency: parsed.frequency,
        isOverridden: true,
      },
    });

    revalidatePath("/advisor");
    return ok(cadence);
  } catch (err) {
    logSafeError("overrideCadenceAction", err);
    return fail(safeErrorMessage(err, "Failed to override cadence"));
  }
}

/**
 * Get the current cadence for a client.
 * Advisor-only. Verifies advisor-client assignment.
 */
export async function getCadenceAction(
  clientId: string,
): Promise<ActionResult<CadenceInfo | null>> {
  try {
    const { userId } = await requireAdvisorRole();

    const assignment = await verifyAdvisorClientAssignment(clientId, userId);
    if (!assignment.valid) return fail(assignment.error!);

    const cadence = await getCadenceForClient(
      clientId,
      assignment.advisorProfileId!,
    );

    return ok(cadence);
  } catch (err) {
    logSafeError("getCadenceAction", err);
    return fail(safeErrorMessage(err, "Failed to get cadence"));
  }
}
