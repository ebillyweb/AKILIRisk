import {
  pillarCatalogMap,
  scopedPillarCatalog,
  type PillarCatalogEntry,
} from "@/lib/methodology/pillar-catalog";
import {
  paletteForRiskLevel,
  type HeatMapLevel,
  type RiskLevelPalette,
} from "@/lib/assessment/risk-color-palette";
import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";

export interface PillarScoreInput {
  pillar: string;
  score: number | null;
  riskLevel: string | null;
}

export interface HeatMapCell {
  pillarId: string;
  pillarName: string;
  score: number | null;
  level: HeatMapLevel;
  palette: RiskLevelPalette;
}

/**
 * Build heat-map cells in platform pillar catalog order.
 * Pillars absent from inputs render as unassessed.
 */
export function buildHeatMapCells(
  inputs: ReadonlyArray<PillarScoreInput>,
  options: {
    catalog: readonly PillarCatalogEntry[];
    includedPillarIds?: readonly string[];
  },
): HeatMapCell[] {
  const byPillar = new Map<string, PillarScoreInput>();
  for (const item of inputs) {
    byPillar.set(normalizePillarSlug(item.pillar), item);
  }

  const areas = scopedPillarCatalog(
    options.catalog,
    options.includedPillarIds,
  );

  return areas.map((area) => {
    const input = byPillar.get(area.id);
    if (!input || input.riskLevel == null) {
      return {
        pillarId: area.id,
        pillarName: area.name,
        score: input?.score ?? null,
        level: "unassessed" as const,
        palette: paletteForRiskLevel(null),
      };
    }
    const palette = paletteForRiskLevel(input.riskLevel);
    return {
      pillarId: area.id,
      pillarName: area.name,
      score: input.score,
      level: normalizeLevel(input.riskLevel),
      palette,
    };
  });
}

function normalizeLevel(raw: string): HeatMapLevel {
  const lc = raw.toLowerCase();
  if (lc === "low" || lc === "medium" || lc === "high" || lc === "critical") {
    return lc;
  }
  return "unassessed";
}

export function formatHeatMapScore(score: number | null): string {
  if (score == null) return "—";
  return `${score.toFixed(1)} / 3`;
}

export function ariaLabelForCell(cell: HeatMapCell): string {
  if (cell.level === "unassessed") {
    return `${cell.pillarName}: not assessed`;
  }
  const scoreSuffix = cell.score == null ? "" : `, score ${cell.score.toFixed(1)} of 3`;
  return `${cell.pillarName}: ${cell.palette.label.toLowerCase()}${scoreSuffix}`;
}

const LEVEL_SEVERITY: Record<HeatMapLevel, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  unassessed: 0,
};

export function rowSeverity(cells: ReadonlyArray<HeatMapCell>): {
  max: number;
  avg: number;
} {
  if (cells.length === 0) return { max: 0, avg: 0 };
  let max = 0;
  let sum = 0;
  let counted = 0;
  for (const c of cells) {
    const s = LEVEL_SEVERITY[c.level];
    if (s > max) max = s;
    if (c.level !== "unassessed") {
      sum += s;
      counted += 1;
    }
  }
  return { max, avg: counted > 0 ? sum / counted : 0 };
}

/** Lookup helper for portfolio heat-map column headers. */
export function pillarCatalogNamesById(
  catalog: readonly PillarCatalogEntry[],
): Map<string, string> {
  const map = pillarCatalogMap(catalog);
  return new Map([...map.entries()].map(([id, entry]) => [id, entry.name]));
}
