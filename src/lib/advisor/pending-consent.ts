import "server-only";

/**
 * Option D session 2.2 (BRD §5.1 amendment) — resolve assignments that
 * need an explicit consent decision from the client before they can
 * proceed to the dashboard.
 *
 * An assignment needs consent when:
 *
 *   • status = ACTIVE
 *   • fieldVisibility IS NULL (the backfill-race case OR a future
 *     admin-reassign creation that intentionally seeds null)
 *
 * The /dashboard page runs `listAssignmentsAwaitingConsent` early and
 * redirects to /consent/pending when the list is non-empty. The
 * /consent/pending page consumes the same helper to render per-field
 * Yes/No prompts. After every assignment's fieldVisibility is set
 * (any non-null shape), the helper returns [] and the dashboard
 * renders normally.
 *
 * Idempotent revisit: once /consent/pending writes a non-null shape
 * for every flagged assignment, the next dashboard visit's call
 * returns [] and the gate is a no-op.
 */

import { prisma } from "@/lib/db";
import {
  parsePiiPolicy,
  type PiiPolicy,
} from "@/lib/advisor/pii-policy";

export interface PendingConsentAssignment {
  assignmentId: string;
  advisorProfileId: string;
  /** Advisor's firmName for the prompt header. Falls back to "your
   *  advisor" when unset. */
  firmName: string | null;
  /** The advisor's current piiPolicy — drives which per-field prompts
   *  surface ("Allow Advisor X to see your phone?"). Fields the
   *  advisor's policy disables don't get prompted (the advisor isn't
   *  collecting them; consenting is moot). */
  advisorPolicy: PiiPolicy;
}

/** Returns every active assignment for `clientUserId` whose
 *  `fieldVisibility` is null, paired with the advisor's current
 *  piiPolicy so the consent page can render per-field prompts. */
export async function listAssignmentsAwaitingConsent(
  clientUserId: string
): Promise<PendingConsentAssignment[]> {
  const rows = await prisma.clientAdvisorAssignment.findMany({
    where: {
      clientId: clientUserId,
      status: "ACTIVE",
      // Prisma JSON-null filter — matches DB NULL specifically (not
      // the JSON value "null"). The backfill UPDATE in migration
      // 20260523120000_pii_policy populated every existing row, so
      // this filter typically returns zero rows in production today;
      // the helper exists for the future admin-reassign UI + the
      // race-window edge case.
      fieldVisibility: { equals: null },
    },
    orderBy: { assignedAt: "asc" },
    select: {
      id: true,
      advisorId: true,
      advisor: {
        select: { firmName: true, piiPolicy: true },
      },
    },
  });

  return rows.map((r) => ({
    assignmentId: r.id,
    advisorProfileId: r.advisorId,
    firmName: r.advisor.firmName,
    advisorPolicy: parsePiiPolicy(r.advisor.piiPolicy),
  }));
}

/** Convenience: returns true when the client has at least one
 *  ACTIVE assignment with null fieldVisibility. Used by /dashboard's
 *  early gate where we only need a boolean. Cheaper than the full
 *  listAssignmentsAwaitingConsent — one count() round-trip. */
export async function hasPendingConsent(clientUserId: string): Promise<boolean> {
  const count = await prisma.clientAdvisorAssignment.count({
    where: {
      clientId: clientUserId,
      status: "ACTIVE",
      fieldVisibility: { equals: null },
    },
  });
  return count > 0;
}
