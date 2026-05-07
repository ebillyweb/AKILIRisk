import { RISK_AREAS } from "@/lib/advisor/types";
import {
  paletteForRiskLevel,
  type RiskLevelPalette,
  type HeatMapLevel,
} from "@/lib/assessment/risk-color-palette";
import type { PillarScoreInput } from "@/lib/assessment/heat-map-data";

/**
 * §4.3 close-out (BRD): pure helpers powering the client dashboard.
 *
 * Two outputs that the server component on `/dashboard` needs:
 *
 *   1. The "Overall Risk" hero tile — a single score + risk-level pair
 *      summarizing the assessment as a whole. We use the most recently
 *      calculated PillarScore (mirrors the existing `assessments[0]
 *      .scores[0]` selection on the dashboard today) as the canonical
 *      overall — there's no aggregate row in the schema, and the
 *      existing convention is "the most recently scored pillar carries
 *      the badge."
 *
 *   2. The "Top Risks" mini-list — 2-3 worst pillars with a one-line
 *      description and a Review link. Sorted by severity DESC
 *      (CRITICAL > HIGH > MEDIUM > LOW), score ASC tiebreaker so the
 *      lowest score within the same band surfaces first.
 *
 * Pure functions; no Prisma access. The dashboard server component is
 * responsible for loading PillarScore rows and passing them in.
 */

export interface OverallRisk {
  /** Maturity score 0–10 from the latest PillarScore. */
  score: number;
  /** Persisted Prisma enum value (UPPERCASE), e.g. "MEDIUM". */
  riskLevel: string;
  /** Resolved palette so the dashboard tile can color-match the
   *  heat-map cell for the same pillar. */
  palette: RiskLevelPalette;
}

export interface TopRisk {
  pillarId: string;
  pillarName: string;
  summary: string;
  score: number;
  riskLevel: string;
  level: HeatMapLevel;
  palette: RiskLevelPalette;
}

const LEVEL_SEVERITY: Record<HeatMapLevel, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  unassessed: 0,
};

function normalizeLevel(raw: string | null | undefined): HeatMapLevel {
  if (raw == null) return "unassessed";
  const lc = raw.toLowerCase();
  if (lc === "low" || lc === "medium" || lc === "high" || lc === "critical") {
    return lc;
  }
  return "unassessed";
}

/** Map of pillar id → display name + summary, keyed off RISK_AREAS so
 *  the dashboard never invents copy. */
const PILLAR_BY_ID = new Map<string, { name: string; summary: string }>();
for (const area of RISK_AREAS) {
  PILLAR_BY_ID.set(area.id, { name: area.name, summary: area.summary });
}

/**
 * Resolve the "Overall Risk" hero tile from a list of pillar inputs +
 * the latest scored pillar's score/level (already loaded by the
 * dashboard's existing `assessments[0].scores[0]` query).
 *
 * Returns `null` when no scored pillar exists — the dashboard renders
 * a "Complete your assessment" placeholder in that case.
 */
export function resolveOverallRisk(input: {
  score: number | null;
  riskLevel: string | null;
}): OverallRisk | null {
  if (input.score == null || input.riskLevel == null) return null;
  return {
    score: input.score,
    riskLevel: input.riskLevel,
    palette: paletteForRiskLevel(input.riskLevel),
  };
}

/**
 * Pick the 2-3 worst pillars for the "Top Risks" mini-list.
 *
 * Ordering:
 *   1. severity DESC — critical first, then high, then medium, then low
 *   2. score ASC — tiebreaker; lowest within a band is "more at risk"
 *   3. pillarId ASC — final deterministic fallback
 *
 * Excludes unassessed pillars. When fewer than `limit` scored pillars
 * exist, returns whatever is available — the dashboard handles the
 * empty case (the entire section hides when zero rows are returned).
 */
export function resolveTopRisks(
  pillarScores: ReadonlyArray<PillarScoreInput>,
  limit = 3
): TopRisk[] {
  const enriched: TopRisk[] = [];
  for (const p of pillarScores) {
    const meta = PILLAR_BY_ID.get(p.pillar);
    if (!meta) continue; // Drop pillars we don't recognize (defensive).
    const level = normalizeLevel(p.riskLevel);
    if (level === "unassessed" || p.score == null) continue;
    enriched.push({
      pillarId: p.pillar,
      pillarName: meta.name,
      summary: meta.summary,
      score: p.score,
      riskLevel: p.riskLevel ?? "",
      level,
      palette: paletteForRiskLevel(p.riskLevel),
    });
  }

  enriched.sort((a, b) => {
    const sevDelta = LEVEL_SEVERITY[b.level] - LEVEL_SEVERITY[a.level];
    if (sevDelta !== 0) return sevDelta;
    if (a.score !== b.score) return a.score - b.score; // lowest score first
    return a.pillarId.localeCompare(b.pillarId);
  });

  return enriched.slice(0, limit);
}
