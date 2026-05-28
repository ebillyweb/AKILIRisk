import "server-only";

import type { Prisma } from "@prisma/client";
import { DeliverablePhase } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * BRD §6.3 / Epic 5.10 — Deliverable-phase state machine.
 *
 * Phase 1 PREVIEW   — questionnaire complete; heat-map view, no plan, no upsell.
 * Phase 2 PROFILE   — advisor has published the report; full plan visible,
 *                     upsell triggers (Section 6.2) evaluated and surfaced.
 * Phase 3 PORTFOLIO — client has accepted the recommendation; advisor owns
 *                     scheduling and execution.
 *
 * Forward-only transitions. The transitions are idempotent: re-entering a
 * phase that is already current is a no-op (it does not re-stamp the
 * `*EnteredAt` field or emit duplicate notifications).
 */
export { DeliverablePhase };

const PHASE_ORDER: Record<DeliverablePhase, number> = {
  PREVIEW: 1,
  PROFILE: 2,
  PORTFOLIO: 3,
};

export function isForwardTransition(
  from: DeliverablePhase | null | undefined,
  to: DeliverablePhase
): boolean {
  if (!from) return true;
  return PHASE_ORDER[to] > PHASE_ORDER[from];
}

/**
 * Move an assessment into Phase 1 (PREVIEW) when scoring completes. Sets
 * `previewEnteredAt` only on the first transition into PREVIEW so the
 * 48-hour advisory-outreach SLA clock is preserved across re-scoring.
 */
export async function enterPreview(
  tx: Tx,
  assessmentId: string,
  now: Date = new Date()
): Promise<void> {
  const current = await tx.assessment.findUnique({
    where: { id: assessmentId },
    select: { deliverablePhase: true, previewEnteredAt: true },
  });
  if (!current) return;
  // PREVIEW is the default; only stamp the timestamp if not already set.
  if (current.previewEnteredAt) return;
  await tx.assessment.update({
    where: { id: assessmentId },
    data: { deliverablePhase: "PREVIEW", previewEnteredAt: now },
  });
}

/**
 * Move an assessment into Phase 2 (PROFILE) when the advisor publishes the
 * report. Stores the upsell triggers that fired at publish time. Idempotent
 * across republish: `profileEnteredAt` is preserved on the first entry.
 */
export async function enterProfile(
  tx: Tx,
  assessmentId: string,
  triggers: string[],
  now: Date = new Date()
): Promise<void> {
  const current = await tx.assessment.findUnique({
    where: { id: assessmentId },
    select: { deliverablePhase: true, profileEnteredAt: true },
  });
  if (!current) return;
  const isFirst = !current.profileEnteredAt;
  await tx.assessment.update({
    where: { id: assessmentId },
    data: {
      deliverablePhase: isForwardTransition(current.deliverablePhase, "PROFILE")
        ? "PROFILE"
        : current.deliverablePhase,
      profileEnteredAt: isFirst ? now : current.profileEnteredAt ?? now,
      upsellTriggersFired: triggers as unknown as Prisma.InputJsonValue,
    },
  });
}

/**
 * Move an assessment into Phase 3 (PORTFOLIO) when the client accepts the
 * recommendation. Called from the PortfolioEngagement.accept server action
 * inside the same transaction that creates the engagement row.
 */
export async function enterPortfolio(
  tx: Tx,
  assessmentId: string,
  now: Date = new Date()
): Promise<void> {
  const current = await tx.assessment.findUnique({
    where: { id: assessmentId },
    select: { deliverablePhase: true, portfolioEnteredAt: true },
  });
  if (!current) return;
  if (current.portfolioEnteredAt) return;
  await tx.assessment.update({
    where: { id: assessmentId },
    data: { deliverablePhase: "PORTFOLIO", portfolioEnteredAt: now },
  });
}
