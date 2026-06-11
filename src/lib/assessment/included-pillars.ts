import { RISK_AREAS } from "@/lib/advisor/types";
import {
  ASSESSMENT_PILLAR_IDS,
  isAssessmentPillarId,
  normalizePillarSlug,
} from "@/lib/assessment/pillar-registry";

/** Full six-pillar scope used for legacy rows and default backfill. */
export const DEFAULT_INCLUDED_PILLARS: readonly string[] = ASSESSMENT_PILLAR_IDS;

export const TOTAL_ASSESSMENT_PILLAR_COUNT = DEFAULT_INCLUDED_PILLARS.length;

/**
 * Resolve assessment pillar scope. Empty or missing `includedPillars` means all
 * six canonical pillars (back-compat for pre–Epic 5.11 rows and pre-approval creates).
 */
export function resolveIncludedPillars(
  includedPillars: string[] | null | undefined,
): string[] {
  if (!includedPillars || includedPillars.length === 0) {
    return [...DEFAULT_INCLUDED_PILLARS];
  }
  return includedPillars.map((id) => normalizePillarSlug(id));
}

/**
 * Validate and dedupe pillar ids for writes (approval, assessment create, admin tags).
 * Throws on unknown ids; preserves first-seen order.
 */
export function normalizeIncludedPillarIds(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of raw) {
    const normalized = normalizePillarSlug(id.trim());
    if (!normalized) continue;
    if (!isAssessmentPillarId(normalized)) {
      throw new Error(`Unknown assessment pillar: ${id}`);
    }
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

/** True when every pillar in scope has a score row. */
export function isAssessmentScopeComplete(
  scoredPillarIds: Iterable<string>,
  includedPillars: string[] | null | undefined,
): boolean {
  const scoped = resolveIncludedPillars(includedPillars);
  const scored = new Set(
    [...scoredPillarIds].map((id) => normalizePillarSlug(id)),
  );
  return scoped.every((id) => scored.has(id));
}

/** True when a pillar slug is within the assessment's included scope. */
export function isPillarInAssessmentScope(
  pillarSlug: string,
  includedPillars: string[] | null | undefined,
): boolean {
  const normalized = normalizePillarSlug(pillarSlug);
  return resolveIncludedPillars(includedPillars).includes(normalized);
}

/** True when the resolved scope is fewer than all six canonical pillars. */
export function isNarrowAssessmentScope(includedPillars: string[]): boolean {
  return includedPillars.length < TOTAL_ASSESSMENT_PILLAR_COUNT;
}

/** Display name for a canonical pillar id. */
export function pillarDisplayName(pillarId: string): string {
  const normalized = normalizePillarSlug(pillarId);
  return RISK_AREAS.find((area) => area.id === normalized)?.name ?? pillarId;
}

/** Comma-separated pillar names in scope order. */
export function formatIncludedPillarNames(includedPillars: string[]): string {
  return includedPillars.map((id) => pillarDisplayName(id)).join(", ");
}

/** Client-facing risk preview scope summary (US-72). */
export function formatNarrowScopePreviewCopy(includedPillars: string[]): string {
  const count = includedPillars.length;
  const names = formatIncludedPillarNames(includedPillars);
  return `Based on ${count} of ${TOTAL_ASSESSMENT_PILLAR_COUNT} household risk domains selected by your advisor: ${names}.`;
}
