import "server-only";

/**
 * C2 (BRD §7.2): friendly-name lookup for the per-entity history page.
 *
 * The history page header reads "History — {EntityType} {entityName}";
 * this helper resolves the entity-specific column to use as the display
 * name (e.g. ServiceRecommendation.name, AssessmentBankQuestion.text).
 * Graceful fallback to `${entityType} ${id.slice(0,8)}` when no lookup
 * is wired or the row no longer exists.
 *
 * One switch per entity type — additions for new entities are localized
 * here, not threaded through the page component.
 */

import { prisma } from "@/lib/db";
import { decryptUserEmail } from "@/lib/auth/user-email";

export interface EntityDisplayInfo {
  /** Friendly name to render in the page header. */
  displayName: string;
  /** Where the "edit" link should point, when the entity has an admin
   *  edit page. Null when there isn't one (e.g. Assessment is not
   *  edited via the admin UI). */
  editHref: string | null;
}

export async function lookupEntityDisplay(
  entityType: string,
  entityId: string
): Promise<EntityDisplayInfo> {
  const fallback: EntityDisplayInfo = {
    displayName: `${entityType} ${entityId.slice(0, 8)}`,
    editHref: null,
  };

  try {
    switch (entityType) {
      case "ServiceRecommendation": {
        const row = await prisma.serviceRecommendation.findUnique({
          where: { id: entityId },
          select: { name: true },
        });
        if (!row) return fallback;
        return {
          displayName: row.name,
          editHref: `/admin/recommendations/services/${entityId}/edit`,
        };
      }
      case "RecommendationRule": {
        const row = await prisma.recommendationRule.findUnique({
          where: { id: entityId },
          select: { ruleName: true },
        });
        if (!row) return fallback;
        return {
          displayName: row.ruleName,
          editHref: `/admin/recommendations/rules/${entityId}/edit`,
        };
      }
      case "AssessmentBankQuestion": {
        const row = await prisma.assessmentBankQuestion.findUnique({
          where: { id: entityId },
          select: { text: true, riskAreaId: true },
        });
        if (!row) return fallback;
        const display = row.text.length > 80 ? row.text.slice(0, 80) + "…" : row.text;
        return {
          displayName: display,
          editHref: `/admin/question-bank/${row.riskAreaId}`,
        };
      }
      case "PillarQuestion": {
        const row = await prisma.pillarQuestion.findUnique({
          where: { id: entityId },
          select: { questionText: true },
        });
        if (!row) return fallback;
        const display =
          row.questionText.length > 80 ? row.questionText.slice(0, 80) + "…" : row.questionText;
        return { displayName: display, editHref: null };
      }
      case "Assessment": {
        // Round-11 commit 2.4b: ciphertext + decrypt fallback.
        const row = await prisma.assessment.findUnique({
          where: { id: entityId },
          select: { user: { select: { emailCiphertext: true, name: true } } },
        });
        if (!row) return fallback;
        const owner = row.user.name || decryptUserEmail(row.user.emailCiphertext);
        return { displayName: `Assessment for ${owner}`, editHref: null };
      }
      case "User": {
        // Round-11 commit 2.4b: ciphertext + decrypt fallback.
        const row = await prisma.user.findUnique({
          where: { id: entityId },
          select: { name: true, emailCiphertext: true },
        });
        if (!row) return fallback;
        return {
          displayName: row.name || decryptUserEmail(row.emailCiphertext),
          editHref: `/admin/clients/${entityId}`,
        };
      }
      default:
        return fallback;
    }
  } catch {
    // findUnique can throw on malformed ids; fall back gracefully.
    return fallback;
  }
}
