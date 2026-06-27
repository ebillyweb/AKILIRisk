import {
  maturityHeatLevel,
  maturityScoreToPercent,
} from "@/lib/assessment/governance-rubric";
import { RISK_LEVEL_PALETTE } from "@/lib/assessment/risk-color-palette";
import type { SamplePillarScore } from "@/lib/marketing/sample-report-preview";
import { cn } from "@/lib/utils";

type SamplePillarCoverageGridProps = {
  pillars: SamplePillarScore[];
  className?: string;
};

function cellHeatClass(maturity: number): string {
  const heat = maturityHeatLevel(maturity);
  if (heat === "strong") return RISK_LEVEL_PALETTE.low.bg;
  if (heat === "fair") return RISK_LEVEL_PALETTE.medium.bg;
  if (heat === "weak") return RISK_LEVEL_PALETTE.high.bg;
  return RISK_LEVEL_PALETTE.critical.bg;
}

export function SamplePillarCoverageGrid({
  pillars,
  className,
}: SamplePillarCoverageGridProps) {
  return (
    <div
      className={cn("grid grid-cols-2 gap-2 sm:grid-cols-5", className)}
      data-testid="sample-pillar-coverage-grid"
    >
      {pillars.map((pillar) => {
        const percent = maturityScoreToPercent(pillar.maturity);

        return (
          <div
            key={pillar.slug}
            className={cn(
              "flex min-h-[4.5rem] flex-col items-center justify-center rounded-lg border px-2 py-2.5 text-center transition-colors",
              pillar.inScope
                ? "border-border/70 bg-background/80"
                : "border-dashed border-border/50 bg-muted/15",
              pillar.inScope && pillar.emphasized && "border-amber-300 ring-1 ring-amber-200/80",
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {pillar.shortName}
            </p>
            {pillar.inScope ? (
              <>
                <p className="mt-1 font-mono text-base font-semibold tabular-nums text-foreground">
                  {percent}
                </p>
                <div className="mt-1.5 h-1 w-full max-w-[3.5rem] overflow-hidden rounded-full bg-secondary/90">
                  <div
                    className={cn("h-full rounded-full", cellHeatClass(pillar.maturity))}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
                Not in scope
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
