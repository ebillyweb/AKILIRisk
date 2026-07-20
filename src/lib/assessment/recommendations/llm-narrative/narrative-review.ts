/**
 * Phase 4 — advisor review state for AI-generated recommendation narratives.
 *
 * Generation writes the narrative in "pending" review. An advisor sees it,
 * optionally edits it, then approves it. Clients only ever see an APPROVED
 * narrative; before approval (or if generation was skipped / fail-closed) the
 * client sees today's static catalog copy.
 *
 * The review envelope is stored next to the copy on
 * `AssessmentRecommendation.customization`:
 *   customization.aiNarrative       — the current display copy (edited in place)
 *   customization.aiNarrativeReview  — this review envelope
 *
 * These are pure helpers; the server actions and persistence wire them to the DB.
 */

export type NarrativeReviewStatus = "pending" | "approved";

/** The fields an advisor may edit (summary/citations/confidence are not editable). */
export type EditableNarrative = {
  headline: string;
  rationale: string;
  tailoredActions: string[];
};

export type NarrativeReview = {
  status: NarrativeReviewStatus;
  /** True once an advisor has changed the generated copy. */
  edited: boolean;
  /** Advisor userId who approved. */
  reviewedBy?: string;
  /** ISO timestamp of approval. */
  reviewedAt?: string;
  /** The model's original copy, preserved the first time an advisor edits. */
  original?: EditableNarrative;
};

/** The review state a freshly generated narrative starts in. */
export const PENDING_REVIEW: NarrativeReview = { status: "pending", edited: false };

/** Parse an unknown JSON value into a NarrativeReview, defaulting to pending. */
export function parseReview(raw: unknown): NarrativeReview {
  const r = (raw ?? {}) as Partial<NarrativeReview>;
  const status: NarrativeReviewStatus = r.status === "approved" ? "approved" : "pending";
  return {
    status,
    edited: Boolean(r.edited),
    ...(typeof r.reviewedBy === "string" ? { reviewedBy: r.reviewedBy } : {}),
    ...(typeof r.reviewedAt === "string" ? { reviewedAt: r.reviewedAt } : {}),
    ...(r.original ? { original: r.original } : {}),
  };
}

/** Clients only see approved narratives. */
export function isNarrativeVisibleToClient(review: NarrativeReview | null | undefined): boolean {
  return review?.status === "approved";
}

/** Advisors/admins always see a generated narrative, approved or not. */
export function isNarrativeVisibleToAdvisor(hasNarrative: boolean): boolean {
  return hasNarrative;
}

/** Only defined, non-empty edit fields are applied. */
function pickEdits(edit: Partial<EditableNarrative>): Partial<EditableNarrative> {
  const out: Partial<EditableNarrative> = {};
  if (typeof edit.headline === "string" && edit.headline.trim()) out.headline = edit.headline;
  if (typeof edit.rationale === "string" && edit.rationale.trim()) out.rationale = edit.rationale;
  if (Array.isArray(edit.tailoredActions) && edit.tailoredActions.length > 0) {
    out.tailoredActions = edit.tailoredActions.filter((a) => typeof a === "string" && a.trim());
  }
  return out;
}

/**
 * Apply an advisor edit. Preserves the model's original copy the first time, and
 * marks the review edited. Does NOT change approval status — editing an approved
 * narrative keeps it approved (the advisor is refining published copy).
 */
export function applyNarrativeEdit<T extends EditableNarrative>(
  narrative: T,
  review: NarrativeReview,
  edit: Partial<EditableNarrative>,
): { narrative: T; review: NarrativeReview } {
  const edits = pickEdits(edit);
  const original =
    review.original ?? {
      headline: narrative.headline,
      rationale: narrative.rationale,
      tailoredActions: narrative.tailoredActions,
    };
  return {
    narrative: { ...narrative, ...edits },
    review: { ...review, edited: true, original },
  };
}

/** Approve the current copy so the client can see it. */
export function approveNarrative(
  review: NarrativeReview,
  advisorId: string,
  nowIso: string,
): NarrativeReview {
  return { ...review, status: "approved", reviewedBy: advisorId, reviewedAt: nowIso };
}

/** Return an approved narrative to pending (unpublish from the client). */
export function unapproveNarrative(review: NarrativeReview): NarrativeReview {
  return { ...review, status: "pending", reviewedBy: undefined, reviewedAt: undefined };
}
