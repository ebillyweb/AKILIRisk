import {
  paletteForRiskLevel,
  type RiskLevelPalette,
  type HeatMapLevel,
} from "@/lib/assessment/risk-color-palette";
import type { PillarScoreInput } from "@/lib/assessment/heat-map-data";
import {
  pillarCatalogMap,
  type PillarCatalogEntry,
} from "@/lib/methodology/pillar-catalog";

export interface OverallRisk {
  score: number;
  riskLevel: string;
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

export function resolveTopRisks(
  pillarScores: ReadonlyArray<PillarScoreInput>,
  catalog: readonly PillarCatalogEntry[],
  limit = 3,
): TopRisk[] {
  const metaById = pillarCatalogMap(catalog);
  const enriched: TopRisk[] = [];

  for (const p of pillarScores) {
    const meta = metaById.get(p.pillar);
    if (!meta) continue;
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
    if (a.score !== b.score) return a.score - b.score;
    return a.pillarId.localeCompare(b.pillarId);
  });

  return enriched.slice(0, limit);
}
