import { RISK_AREAS } from "@/lib/advisor/types";

export const RISK_AREA_IDS = RISK_AREAS.map((a) => a.id) as readonly string[];

export function isRiskAreaId(id: string): id is (typeof RISK_AREA_IDS)[number] {
  return (RISK_AREA_IDS as readonly string[]).includes(id);
}

/**
 * F2 / BRD §4.1 — legacy → current ID redirect map.
 *
 * Migration 20260521120000 renamed the four drifted IDs in the DB; this
 * map lets the question-bank page-level loaders 302 old bookmarks to the
 * current URL instead of 404-ing. Returns `null` for IDs that were never
 * renamed (and for current IDs already in `RISK_AREAS`).
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
