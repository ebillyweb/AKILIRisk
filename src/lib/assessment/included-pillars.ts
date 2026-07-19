import {
  isPillarInCatalog,
  pillarCatalogDisplayName,
  pillarCatalogSlugs,
  starterPillarCatalog,
  type PillarCatalogEntry,
} from "@/lib/methodology/pillar-catalog";
import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";

/** @deprecated Use pillarCatalogSlugs(await getPlatformPillarCatalog()) on server. */
export const DEFAULT_INCLUDED_PILLARS: readonly string[] = pillarCatalogSlugs(
  starterPillarCatalog(),
);

/**
 * Original Belvedere six-domain engagement scope (pre–10-pillar catalog).
 * Used to detect lock-ins that should expand to the full platform set.
 */
export const LEGACY_SIX_INCLUDED_PILLARS: readonly string[] = [
  "governance",
  "cyber-digital",
  "physical-security",
  "insurance",
  "geographic-environmental",
  "reputational-social",
] as const;

/** True when `included` is exactly the legacy six (order-insensitive). */
export function isLegacySixPillarScope(
  included: readonly string[] | null | undefined,
): boolean {
  if (!included || included.length !== LEGACY_SIX_INCLUDED_PILLARS.length) {
    return false;
  }
  const set = new Set(included.map((id) => normalizePillarSlug(id)));
  return LEGACY_SIX_INCLUDED_PILLARS.every((id) => set.has(id));
}

export function totalPlatformPillarCount(catalog: readonly PillarCatalogEntry[]): number {
  return catalog.length;
}

/** @deprecated Use totalPlatformPillarCount(catalog). */
export const TOTAL_ASSESSMENT_PILLAR_COUNT = DEFAULT_INCLUDED_PILLARS.length;

/**
 * Resolve assessment pillar scope. Empty or missing `includedPillars` means all
 * platform pillars in the supplied catalog.
 */
export function resolveIncludedPillars(
  includedPillars: readonly string[] | null | undefined,
  catalog: readonly PillarCatalogEntry[],
): string[] {
  if (!includedPillars || includedPillars.length === 0) {
    return pillarCatalogSlugs(catalog);
  }
  return includedPillars.map((id) => normalizePillarSlug(id));
}

/**
 * Validate and dedupe pillar ids for writes. Throws on unknown ids; preserves
 * first-seen order.
 */
export function normalizeIncludedPillarIds(
  raw: string[],
  catalog: readonly PillarCatalogEntry[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of raw) {
    const normalized = normalizePillarSlug(id.trim());
    if (!normalized) continue;
    if (!isPillarInCatalog(catalog, normalized)) {
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
  includedPillars: readonly string[] | null | undefined,
  catalog: readonly PillarCatalogEntry[],
): boolean {
  const scoped = resolveIncludedPillars(includedPillars, catalog);
  // An empty resolved scope (e.g. catalog failed to load) must NOT report
  // complete — `[].every()` is vacuously true and would mark an assessment
  // COMPLETED with zero scored pillars.
  if (scoped.length === 0) return false;
  const scored = new Set(
    [...scoredPillarIds].map((id) => normalizePillarSlug(id)),
  );
  return scoped.every((id) => scored.has(id));
}

/** True when a pillar slug is within the assessment's included scope. */
export function isPillarInAssessmentScope(
  pillarSlug: string,
  includedPillars: readonly string[] | null | undefined,
  catalog: readonly PillarCatalogEntry[],
): boolean {
  const normalized = normalizePillarSlug(pillarSlug);
  return resolveIncludedPillars(includedPillars, catalog).includes(normalized);
}

/** True when the resolved scope is fewer than all platform pillars. */
export function isNarrowAssessmentScope(
  includedPillars: readonly string[],
  catalog: readonly PillarCatalogEntry[],
): boolean {
  return includedPillars.length < totalPlatformPillarCount(catalog);
}

/** Display name for a canonical pillar id. */
export function pillarDisplayName(
  pillarId: string,
  catalog: readonly PillarCatalogEntry[],
): string {
  return pillarCatalogDisplayName(catalog, normalizePillarSlug(pillarId));
}

/** Comma-separated pillar names in scope order. */
export function formatIncludedPillarNames(
  includedPillars: readonly string[],
  catalog: readonly PillarCatalogEntry[],
): string {
  return includedPillars.map((id) => pillarDisplayName(id, catalog)).join(", ");
}

/** Natural-language list: "A, B and C". */
export function formatEnglishList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Client-facing risk preview scope summary (US-72). */
export function formatNarrowScopePreviewCopy(
  includedPillars: readonly string[],
  catalog: readonly PillarCatalogEntry[],
): string {
  const count = includedPillars.length;
  const names = formatIncludedPillarNames(includedPillars, catalog);
  return `Based on ${count} of ${totalPlatformPillarCount(catalog)} household risk domains selected by your advisor: ${names}.`;
}
