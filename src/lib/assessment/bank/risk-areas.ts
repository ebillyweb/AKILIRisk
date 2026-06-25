import {
  isPillarInCatalog,
  pillarCatalogMap,
  type PillarCatalogEntry,
} from "@/lib/methodology/pillar-catalog";

export function isRiskAreaId(
  id: string,
  catalog: readonly PillarCatalogEntry[],
): boolean {
  return isPillarInCatalog(catalog, id);
}

export function riskAreaFromCatalog(
  catalog: readonly PillarCatalogEntry[],
  riskAreaId: string,
): PillarCatalogEntry | undefined {
  return pillarCatalogMap(catalog).get(riskAreaId);
}

/**
 * F2 / BRD §4.1 — legacy → current ID redirect map.
 *
 * Migration 20260521120000 renamed the four drifted IDs in the DB; this
 * map lets the question-bank page-level loaders 302 old bookmarks to the
 * current URL instead of 404-ing. Returns `null` for IDs that were never
 * renamed (and for current IDs already in the platform catalog).
 *
 * Stop-using-this date: Phase 3 / D2C launch. Revisit then; if no traffic
 * to the old IDs in 90 days, the map can be removed and old bookmarks
 * 404 like any other stale URL.
 */
const LEGACY_RISK_AREA_ID_REDIRECT: Record<string, string> = {
  cybersecurity: "cyber-digital",
  "financial-asset-protection": "insurance",
  "environmental-geographic-risk": "geographic-environmental",
  "lifestyle-behavioral-risk": "reputational-social",
};

export function legacyRiskAreaRedirect(id: string): string | null {
  return LEGACY_RISK_AREA_ID_REDIRECT[id] ?? null;
}
