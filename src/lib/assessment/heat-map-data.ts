import { RISK_AREAS } from "@/lib/advisor/types";
import {
  paletteForRiskLevel,
  type HeatMapLevel,
  type RiskLevelPalette,
} from "@/lib/assessment/risk-color-palette";

/**
 * Per-pillar input shape for the heat map. Both the per-client and
 * portfolio variants take the same per-pillar data — `score` is the 0–3
 * maturity number persisted on PillarScore; `riskLevel` is the persisted
 * Prisma enum value (UPPERCASE) or null when not assessed.
 */
export interface PillarScoreInput {
  /** Pillar id from RISK_AREAS (e.g. "governance", "cybersecurity"). */
  pillar: string;
  score: number | null;
  riskLevel: string | null;
}

/** Render shape for one cell: filled in for the canonical 6 pillars,
 *  unassessed when the input list omits a pillar. */
export interface HeatMapCell {
  /** Pillar id from RISK_AREAS. */
  pillarId: string;
  /** Display name from RISK_AREAS. */
  pillarName: string;
  /** Maturity score 0–3, or null if not assessed. */
  score: number | null;
  /** Normalized lowercase RiskLevel or 'unassessed'. */
  level: HeatMapLevel;
  /** Resolved palette entry — same source the legacy color helpers now use. */
  palette: RiskLevelPalette;
}

/**
 * Build the canonical 6-cell heat-map row for one assessment.
 *
 * - Iterates RISK_AREAS in their declared order so the heat map's column
 *   order is stable across clients (governance always leftmost, etc.).
 * - Pillars present in `inputs` get their score + level + palette.
 * - Pillars absent from `inputs` get an `unassessed` cell so the map is
 *   always 6 cells wide regardless of which pillars have been scored.
 * - Tolerates the persisted Prisma uppercase enum values via
 *   `paletteForRiskLevel`.
 */
export function buildHeatMapCells(
  inputs: ReadonlyArray<PillarScoreInput>
): HeatMapCell[] {
  const byPillar = new Map<string, PillarScoreInput>();
  for (const item of inputs) {
    byPillar.set(item.pillar, item);
  }
  return RISK_AREAS.map((area) => {
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

/** Format a 0–3 maturity score for cell display. Centralized so the web and
 *  PDF heat maps render the same string. */
export function formatHeatMapScore(score: number | null): string {
  if (score == null) return "—";
  return `${score.toFixed(1)} / 3`;
}

/** Render-ready aria-label for one cell. Centralized so the web heat map
 *  doesn't drift from a future PDF accessibility pass. */
export function ariaLabelForCell(cell: HeatMapCell): string {
  if (cell.level === "unassessed") {
    return `${cell.pillarName}: not assessed`;
  }
  const scoreSuffix = cell.score == null ? "" : `, score ${cell.score.toFixed(1)} of 3`;
  return `${cell.pillarName}: ${cell.palette.label.toLowerCase()}${scoreSuffix}`;
}

/** Sort key for the portfolio heat map: most-at-risk first.
 *  Maps the levels to a numeric severity so we can sort an arbitrary mix
 *  of clients deterministically. */
const LEVEL_SEVERITY: Record<HeatMapLevel, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  unassessed: 0,
};

/**
 * Compute an overall "row severity" score for a client given their pillar
 * cells. Used to sort the portfolio heat map descending — most-at-risk
 * client first. Heuristic: take the max severity across pillars; tiebreak
 * on average severity so two HIGHs beat one HIGH + four LOWs.
 */
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
