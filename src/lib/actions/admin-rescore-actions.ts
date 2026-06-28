"use server";

/**
 * C2 (BRD §7.2): admin rescore actions.
 */

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/admin/auth";
import { logSafeError, safeErrorMessage } from "@/lib/log-safe-error";
import {
  executeAssessmentRescore,
  type RescoreActionResult,
  type RescoreAssessmentResult,
} from "@/lib/assessment/execute-assessment-rescore";

const rescoreInputSchema = z.object({
  assessmentId: z.string().cuid(),
  reason: z.string().max(500).optional(),
});
export type RescoreInput = z.infer<typeof rescoreInputSchema>;

const rescoreBulkInputSchema = z
  .object({
    advisorProfileId: z.string().cuid().optional(),
    sinceCompletedAt: z.coerce.date().optional(),
    reason: z.string().max(500).optional(),
    maxAssessments: z.number().int().min(1).max(500).default(100),
  })
  .strict();
export type RescoreBulkInput = z.input<typeof rescoreBulkInputSchema>;

export type ActionResult<T = void> = RescoreActionResult<T>;

interface RescoreBulkResult {
  attempted: number;
  successCount: number;
  failureCount: number;
  failures: Array<{ assessmentId: string; error: string }>;
  successes: Array<{ assessmentId: string; newVersion: number }>;
}

function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}
function fail(error: string): ActionResult<never> {
  return { success: false, error };
}

export async function rescoreAssessment(
  input: RescoreInput,
): Promise<ActionResult<RescoreAssessmentResult>> {
  try {
    const actor = await requireAdminRole();
    const parsed = rescoreInputSchema.parse(input);
    return executeAssessmentRescore({
      assessmentId: parsed.assessmentId,
      reason: parsed.reason,
      actor: {
        userId: actor.userId,
        email: actor.email ?? null,
        role: actor.role,
      },
    });
  } catch (err) {
    logSafeError("rescoreAssessment", err);
    return fail(safeErrorMessage(err, "Rescore failed"));
  }
}

export async function rescoreAssessmentsBulk(
  input: RescoreBulkInput,
): Promise<ActionResult<RescoreBulkResult>> {
  try {
    await requireAdminRole();
    const parsed = rescoreBulkInputSchema.parse(input);

    const where: Prisma.AssessmentWhereInput = {
      status: "COMPLETED",
      answersChangedAfterCompleteAt: { not: null },
    };
    if (parsed.sinceCompletedAt) {
      where.completedAt = { gte: parsed.sinceCompletedAt };
    }
    if (parsed.advisorProfileId) {
      const assignments = await prisma.clientAdvisorAssignment.findMany({
        where: { advisorId: parsed.advisorProfileId },
        select: { clientId: true },
      });
      const clientIds = assignments.map((a) => a.clientId);
      if (clientIds.length === 0) {
        return ok({
          attempted: 0,
          successCount: 0,
          failureCount: 0,
          failures: [],
          successes: [],
        });
      }
      where.userId = { in: clientIds };
    }

    const candidates = await prisma.assessment.findMany({
      where,
      select: { id: true },
      orderBy: { completedAt: "desc" },
      take: parsed.maxAssessments,
    });

    const successes: Array<{ assessmentId: string; newVersion: number }> = [];
    const failures: Array<{ assessmentId: string; error: string }> = [];

    for (const { id } of candidates) {
      const r = await rescoreAssessment({ assessmentId: id, reason: parsed.reason });
      if (r.success) {
        successes.push({ assessmentId: id, newVersion: r.data.newVersion });
      } else {
        failures.push({ assessmentId: id, error: r.error });
      }
    }

    return ok({
      attempted: candidates.length,
      successCount: successes.length,
      failureCount: failures.length,
      failures,
      successes,
    });
  } catch (err) {
    logSafeError("rescoreAssessmentsBulk", err);
    return fail(safeErrorMessage(err, "Bulk rescore failed"));
  }
}
