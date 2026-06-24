"use server";

/**
 * C2 (BRD §7.2): admin rescore actions.
 *
 * Two surfaces:
 *   - rescoreAssessment(input)         — single-assessment, UI-driven via the
 *                                        "Rescore" button on the per-client
 *                                        admin assessment detail page.
 *   - rescoreAssessmentsBulk(input)    — server-action only for v1; UI is a
 *                                        follow-up. Sequential per-row with
 *                                        per-row try/catch + summary report
 *                                        (see design doc rationale).
 *
 * Both:
 *   - require admin role
 *   - run scoring with current rules + risk thresholds
 *   - overwrite PillarScore + AssessmentRecommendation rows atomically
 *     (one prisma.$transaction; rolls back on any sub-step failure)
 *   - bump Assessment.version + set Assessment.lastRescoredAt
 *   - audit-log AFTER the transaction commits with the actual outcome
 *     (success vs partial; before/after captures the prior + new state)
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma, UserRole } from "@prisma/client";
import { Prisma as PrismaNs, RiskLevel as PrismaRiskLevel } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/admin/auth";
import { logSafeError, safeErrorMessage } from "@/lib/log-safe-error";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import { calculatePillarScore } from "@/lib/assessment/scoring";
import { getVisibleQuestions } from "@/lib/assessment/branching";
import { calculateIdentityRiskScore } from "@/lib/identity-risk/scoring";
import { safeDecryptAnswer } from "@/lib/data/response-content";
import type { MissingControl } from "@/lib/assessment/types";
import { RecommendationEngine } from "@/lib/assessment/engines/recommendation-engine";
import {
  resolvePillarConfigForAssessment,
  resolveRecommendationRulesForAssessment,
  resolveThresholdsForAssessmentPillar,
} from "@/lib/methodology/assessment-runtime";

// ── Input shapes ─────────────────────────────────────────────────────────

const rescoreInputSchema = z.object({
  assessmentId: z.string().cuid(),
  /** Optional free-form admin justification surfaced in audit metadata.
   *  Kept short so it fits cleanly in the audit timeline. */
  reason: z.string().max(500).optional(),
});
export type RescoreInput = z.infer<typeof rescoreInputSchema>;

const rescoreBulkInputSchema = z
  .object({
    /** Restrict to one advisor's clients. NULL = all assessments. */
    advisorProfileId: z.string().cuid().optional(),
    /** Restrict to assessments completed on/after this timestamp. */
    sinceCompletedAt: z.coerce.date().optional(),
    /** Optional free-form admin justification. */
    reason: z.string().max(500).optional(),
    /** Hard cap so a runaway bulk can't iterate the entire DB by accident. */
    maxAssessments: z.number().int().min(1).max(500).default(100),
  })
  .strict();
export type RescoreBulkInput = z.input<typeof rescoreBulkInputSchema>;

// ── Result shapes ────────────────────────────────────────────────────────

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

interface RescoreAssessmentResult {
  assessmentId: string;
  newVersion: number;
  rescoredAt: Date;
  pillarsChanged: number;
  recommendationsCount: number;
}

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

// ── Pillar config helpers (mirror src/app/api/assessment/[id]/score/route.ts) ─
//
// We deliberately don't import these from the route file because the
// route's helpers are coupled to its request lifecycle. The duplication
// is intentional and bounded: two pillar dispatch arms + one risk-level
// mapper.

function mapRiskLevelToPrisma(riskLevel: string): PrismaRiskLevel {
  switch (riskLevel) {
    case "low":
      return "LOW";
    case "medium":
      return "MEDIUM";
    case "high":
      return "HIGH";
    case "critical":
      return "CRITICAL";
    default:
      return "MEDIUM";
  }
}

async function getPillarConfig(
  assessmentId: string,
  pillar: string,
) {
  return resolvePillarConfigForAssessment(assessmentId, pillar);
}

// ── Single-assessment rescore ────────────────────────────────────────────

export async function rescoreAssessment(
  input: RescoreInput
): Promise<ActionResult<RescoreAssessmentResult>> {
  let actorUserId: string | null = null;
  let actorEmail: string | null = null;
  let actorRole: string | null = null;
  let beforeSnapshot: { pillarScores: unknown[]; recommendations: unknown[] } | null = null;
  let afterSnapshot: { pillarScores: unknown[]; recommendations: unknown[] } | null = null;
  let parsed: RescoreInput | null = null;

  try {
    const actor = await requireAdminRole();
    actorUserId = actor.userId;
    actorEmail = actor.email ?? null;
    actorRole = actor.role;

    parsed = rescoreInputSchema.parse(input);
    const { assessmentId } = parsed;

    // 1. Load the assessment + the existing pillar scores + responses up-front
    //    so the "before" snapshot is captured BEFORE any writes.
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: {
        id: true,
        userId: true,
        version: true,
        approvalId: true,
        scores: { orderBy: { calculatedAt: "asc" } },
        recommendations: true,
      },
    });
    if (!assessment) return fail("Assessment not found");

    if (assessment.scores.length === 0) {
      return fail("Assessment has no existing pillar scores to rescore — score the assessment normally first.");
    }

    beforeSnapshot = {
      pillarScores: assessment.scores,
      recommendations: assessment.recommendations,
    };

    // 2. Load every response row once. The per-pillar compute filters by
    //    questionId so only the relevant subset gets used per pillar.
    //    Round-11 commit 2.5b: `answer` is now ciphertext; decrypt at
    //    the query layer so the per-pillar scoring engine sees the
    //    same plaintext shape it always has.
    const responses = await prisma.assessmentResponse.findMany({
      where: { assessmentId, skipped: false },
      select: { questionId: true, answer: true, pillar: true },
    });
    // Round-11 cleanup: tamper-resilient decrypt — a single corrupted
    // row returns null instead of crashing the whole rescore.
    const allAnswers: Record<string, unknown> = {};
    for (const r of responses) {
      allAnswers[r.questionId] = safeDecryptAnswer(
        r.answer as unknown as string | null,
        { rowId: r.questionId, column: "AssessmentResponse.answer" }
      );
    }

    // 3. Threshold context: pinned per pillar when assessment has a snapshot.
    const rulesOverride = await resolveRecommendationRulesForAssessment(assessmentId);
    const approvalFocusAreas: string[] | null = assessment.approvalId
      ? (await prisma.intakeApproval
          .findUnique({
            where: { id: assessment.approvalId },
            select: { focusAreas: true },
          })
          ?.then((a) => a?.focusAreas ?? null)) ?? null
      : null;

    // 4. Recompute every existing pillar's score (in memory).
    const newPillarRows: Array<{
      pillar: string;
      score: number;
      riskLevel: PrismaRiskLevel;
      breakdown: Prisma.InputJsonValue;
      missingControls: Prisma.InputJsonValue | null;
    }> = [];

    for (const existing of assessment.scores) {
      const pillarConfig = await getPillarConfig(assessmentId, existing.pillar);
      if (!pillarConfig) {
        // Unknown pillar — preserve the existing row by skipping
        // recompute. This shouldn't happen in practice but defensively
        // we don't lose data.
        continue;
      }
      const activeThresholds = await resolveThresholdsForAssessmentPillar(
        assessmentId,
        existing.pillar,
      );
      const visibleQuestions = getVisibleQuestions(allAnswers, pillarConfig.questions);
      const visibleIds = visibleQuestions.map((q) => q.id);
      const scoreResult =
        existing.pillar === "identity-risk"
          ? calculateIdentityRiskScore(allAnswers, visibleIds, activeThresholds)
          : calculatePillarScore(
              allAnswers,
              pillarConfig.pillarData,
              pillarConfig.questions,
              visibleIds,
              activeThresholds
            );

      newPillarRows.push({
        pillar: existing.pillar,
        score: scoreResult.score,
        riskLevel: mapRiskLevelToPrisma(scoreResult.riskLevel),
        breakdown: scoreResult.breakdown as unknown as Prisma.InputJsonValue,
        missingControls: (scoreResult.missingControls ?? null) as unknown as Prisma.InputJsonValue | null,
      });
    }

    // 5. Recompute recommendations against the new scores (match-only;
    //    persistence happens inside the transaction).
    const pillarScoreMap: Record<string, { score: number; riskLevel: import("@/lib/assessment/types").RiskLevel }> = {};
    for (const p of newPillarRows) {
      pillarScoreMap[p.pillar] = {
        score: p.score,
        riskLevel: p.riskLevel.toLowerCase() as import("@/lib/assessment/types").RiskLevel,
      };
    }
    const aggregatedMissingControls: MissingControl[] = newPillarRows.flatMap((row) => {
      const raw = row.missingControls;
      return Array.isArray(raw) ? (raw as MissingControl[]) : [];
    });

    const engine = new RecommendationEngine();
    const newRecs = await engine.matchAndDedupeRecommendations(
      {
        assessmentId,
        userId: assessment.userId,
        pillarScores: pillarScoreMap,
        answers: allAnswers,
        // The engine's profile_condition handler is a placeholder; passing
        // null is safe.
        householdProfile: null,
        missingControls: aggregatedMissingControls,
      },
      rulesOverride,
    );
    void approvalFocusAreas; // currently unused by recompute; reserved for
                             // future customization parity.

    // 6. ATOMIC TRANSACTION: upsert pillar scores, replace recommendations,
    //    bump version + lastRescoredAt. Any failure rolls all of it back.
    const rescoredAt = new Date();
    const newVersion = (assessment.version ?? 1) + 1;

    await prisma.$transaction(async (tx) => {
      for (const row of newPillarRows) {
        await tx.pillarScore.upsert({
          where: {
            assessmentId_pillar: { assessmentId, pillar: row.pillar },
          },
          create: {
            assessmentId,
            pillar: row.pillar,
            score: row.score,
            riskLevel: row.riskLevel,
            breakdown: row.breakdown,
            missingControls: row.missingControls ?? PrismaNs.JsonNull,
          },
          update: {
            score: row.score,
            riskLevel: row.riskLevel,
            breakdown: row.breakdown,
            missingControls: row.missingControls ?? PrismaNs.JsonNull,
            calculatedAt: rescoredAt,
          },
        });
      }

      // Replace recommendations: delete all old, insert all new.
      await tx.assessmentRecommendation.deleteMany({ where: { assessmentId } });

      if (newRecs.length > 0) {
        await tx.assessmentRecommendation.createMany({
          data: newRecs.slice(0, 10).map((rec, i) => ({
            assessmentId,
            serviceRecommendationId: rec.id,
            triggerReason: { reasons: rec.triggerReason } as unknown as Prisma.InputJsonValue,
            customization:
              rec.customization === null || rec.customization === undefined
                ? PrismaNs.JsonNull
                : (rec.customization as Prisma.InputJsonValue),
            priority: i + 1,
            status: "PENDING" as const,
          })),
          skipDuplicates: true,
        });
      }

      // Use a typed cast for the new lastRescoredAt column — the Prisma
      // client TS types haven't been regenerated in this sandbox (see
      // C1's environmental note). Runtime accepts the field directly.
      await tx.assessment.update({
        where: { id: assessmentId },
        data: ({
          version: newVersion,
          lastRescoredAt: rescoredAt,
          answersChangedAfterCompleteAt: null,
        } as unknown) as Prisma.AssessmentUpdateInput,
      });
    });

    // 7. Capture the new state for audit by reading what we just wrote
    //    (so the "after" snapshot reflects DB state, not in-memory).
    const after = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { scores: true, recommendations: true },
    });
    afterSnapshot = {
      pillarScores: after?.scores ?? [],
      recommendations: after?.recommendations ?? [],
    };

    revalidatePath(`/admin/clients`);
    revalidatePath(`/advisor/pipeline`);
    revalidatePath(`/advisor/analytics`);
    revalidatePath(`/advisor/signals`);

    const { emitAssessmentSignals } = await import("@/lib/signals/emit");
    const { evaluateUpsellTriggers } = await import("@/lib/assessment/upsell-triggers");
    type PillarScoreSnapshot = import("@/lib/signals/types").PillarScoreSnapshot;

    const beforeRows = (beforeSnapshot?.pillarScores ?? []) as Array<{
      pillar: string;
      score: number;
      riskLevel: string;
    }>;
    const afterRows = (afterSnapshot?.pillarScores ?? []) as Array<{
      pillar: string;
      score: number;
      riskLevel: string;
    }>;
    const toSnapshot = (rows: typeof beforeRows): PillarScoreSnapshot[] =>
      rows.map((r) => ({
        pillar: r.pillar,
        score: r.score,
        riskLevel: r.riskLevel,
      }));

    const pillarScoresForTriggers = Object.fromEntries(
      newPillarRows.map((p) => [
        p.pillar,
        {
          resilience: Math.min(100, Math.round((p.score / 3) * 100)),
          riskLevel: p.riskLevel.toLowerCase() as "low" | "medium" | "high" | "critical",
        },
      ])
    );
    const triggersAfter = evaluateUpsellTriggers({
      pillarScores: pillarScoresForTriggers,
      kriHits: [],
    });
    const priorAssessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { upsellTriggersFired: true },
    });
    const triggersBefore = Array.isArray(priorAssessment?.upsellTriggersFired)
      ? (priorAssessment.upsellTriggersFired as string[])
      : [];

    void emitAssessmentSignals({
      clientId: assessment.userId,
      assessmentId,
      version: newVersion,
      event: "rescored",
      beforeScores: toSnapshot(beforeRows),
      afterScores: toSnapshot(afterRows),
      upsellTriggersBefore: triggersBefore,
      upsellTriggersAfter: triggersAfter,
    });

    return ok({
      assessmentId,
      newVersion,
      rescoredAt,
      pillarsChanged: newPillarRows.length,
      recommendationsCount: newRecs.length,
    });
  } catch (err) {
    logSafeError("rescoreAssessment", err);
    return fail(safeErrorMessage(err, "Rescore failed"));
  } finally {
    // Audit-log either success or failure. Writing in finally captures the
    // actual outcome — if the transaction rolled back, beforeSnapshot is
    // populated but afterSnapshot is null (or matches before). The audit
    // row is the canonical record of "an admin attempted a rescore."
    if (actorUserId && parsed) {
      void writeAudit({
        actor: {
          userId: actorUserId,
          role: actorRole as UserRole,
          email: actorEmail,
        },
        action: AUDIT_ACTIONS.ASSESSMENT_RESCORE,
        entityType: "Assessment",
        entityId: parsed.assessmentId,
        beforeData: beforeSnapshot,
        afterData: afterSnapshot,
        metadata: {
          reason: parsed.reason ?? null,
          // succeeded if afterSnapshot was captured (post-transaction
          // read happened successfully); rollback otherwise.
          succeeded: afterSnapshot != null,
        },
      });
    }
  }
}

// ── Bulk rescore ─────────────────────────────────────────────────────────

export async function rescoreAssessmentsBulk(
  input: RescoreBulkInput
): Promise<ActionResult<RescoreBulkResult>> {
  try {
    await requireAdminRole();
    const parsed = rescoreBulkInputSchema.parse(input);

    // Resolve the candidate assessment ids. Bounded by maxAssessments.
    // Filter:
    //   - status = COMPLETED (only assessments that have been scored)
    //   - sinceCompletedAt
    //   - if advisorProfileId set, restrict to clients assigned to that advisor
    const where: Prisma.AssessmentWhereInput = {
      status: "COMPLETED",
    };
    if (parsed.sinceCompletedAt) {
      where.completedAt = { gte: parsed.sinceCompletedAt };
    }
    if (parsed.advisorProfileId) {
      // Hinge through ClientAdvisorAssignment so we don't accidentally
      // touch assessments outside the tenant.
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

    // Sequential per-row rescore with per-row try/catch (per design).
    // Partial success is acceptable; failures are reported in the
    // summary so an operator can inspect + retry the bad rows.
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
