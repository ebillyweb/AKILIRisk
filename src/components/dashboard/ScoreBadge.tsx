import { paletteForRiskLevel } from "@/lib/assessment/risk-color-palette";

interface ScoreBadgeProps {
  score: number | null;
  riskLevel: string | null;
}

/**
 * Round-10: derived from the canonical RISK_LEVEL_PALETTE
 * (`src/lib/assessment/risk-color-palette.ts`). Pre-round-10 this used
 * a slightly different set of Tailwind classes (emerald/amber/orange/red
 * with `-50` background tones); the canonical palette uses `-100` tones,
 * so the dot here gets a marginally deeper background. No change to
 * which color represents which level.
 */
export function ScoreBadge({ score, riskLevel }: ScoreBadgeProps) {
  if (score === null) {
    return <span className="text-sm text-muted-foreground">No assessment</span>;
  }

  const palette = paletteForRiskLevel(riskLevel);

  return (
    <div className="flex items-center gap-2">
      <div className={`h-2 w-2 rounded-full ${palette.bg} ${palette.text}`} />
      <span className="text-sm font-medium">{score.toFixed(1)}</span>
    </div>
  );
}