/**
 * Read the AI narrative off an AssessmentRecommendation's `customization` for
 * display, applying the audience gate:
 *   - clients see it only once an advisor has APPROVED it,
 *   - advisors always see it (with the review status, to drive edit/approve UI).
 *
 * Shared by the client action-plan mapper and the advisor guidance mapper so the
 * gating lives in exactly one place.
 */

import {
  parseReview,
  isNarrativeVisibleToClient,
  type NarrativeReview,
} from "./narrative-review";

export type DisplayNarrative = {
  headline: string;
  rationale: string;
  tailoredActions: string[];
  pillarSummary?: string;
  confidence?: "high" | "medium" | "low";
};

function readNarrative(customization: unknown): {
  narrative: DisplayNarrative | null;
  review: NarrativeReview;
} {
  const c = (customization ?? {}) as Record<string, unknown>;
  const review = parseReview(c.aiNarrativeReview);
  const raw = c.aiNarrative as Record<string, unknown> | undefined;
  if (!raw || typeof raw.headline !== "string" || typeof raw.rationale !== "string") {
    return { narrative: null, review };
  }
  const narrative: DisplayNarrative = {
    headline: raw.headline,
    rationale: raw.rationale,
    tailoredActions: Array.isArray(raw.tailoredActions)
      ? raw.tailoredActions.filter((a): a is string => typeof a === "string")
      : [],
    ...(typeof raw.pillarSummary === "string" ? { pillarSummary: raw.pillarSummary } : {}),
    ...(raw.confidence === "high" || raw.confidence === "medium" || raw.confidence === "low"
      ? { confidence: raw.confidence }
      : {}),
  };
  return { narrative, review };
}

/** Narrative to show a CLIENT — present only when approved. */
export function clientNarrative(customization: unknown): DisplayNarrative | null {
  const { narrative, review } = readNarrative(customization);
  return narrative && isNarrativeVisibleToClient(review) ? narrative : null;
}

/** Narrative + review to show an ADVISOR — always visible when generated. */
export function advisorNarrative(customization: unknown): {
  narrative: DisplayNarrative | null;
  review: NarrativeReview;
} {
  return readNarrative(customization);
}
