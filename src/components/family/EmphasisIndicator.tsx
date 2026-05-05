import { Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { MATURITY_SCALE_MAX } from "@/lib/assessment/maturity-scale";
import { maturityHeatLevel, maturityScoreToPercent } from "@/lib/assessment/governance-rubric";
import { RISK_LEVEL_PALETTE } from "@/lib/assessment/risk-color-palette";

interface EmphasisIndicatorProps {
  pillarName: string;
  score: number;
  isEmphasized: boolean;
  className?: string;
}

export function EmphasisIndicator({
  pillarName,
  score,
  isEmphasized,
  className,
}: EmphasisIndicatorProps) {
  const progressValue = maturityScoreToPercent(score);

  // Round-10: derived from canonical RISK_LEVEL_PALETTE so this progress
  // bar matches the heat-map cell next to it on the same page. The
  // maturity heat tier maps 1:1 onto risk levels — strong→low, fair→medium,
  // weak→high, severe→critical.
  const heatColor = (() => {
    const heat = maturityHeatLevel(score);
    if (heat === "strong") return RISK_LEVEL_PALETTE.low.bg;
    if (heat === "fair") return RISK_LEVEL_PALETTE.medium.bg;
    if (heat === "weak") return RISK_LEVEL_PALETTE.high.bg;
    return RISK_LEVEL_PALETTE.critical.bg;
  })();

  const progressColor = isEmphasized ? RISK_LEVEL_PALETTE.medium.bg : heatColor;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">{pillarName}</h4>
          <p className="text-sm text-muted-foreground">
            {progressValue} / 100 resilience ({score.toFixed(1)} / {MATURITY_SCALE_MAX} maturity)
          </p>
        </div>
        {isEmphasized && (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            Advisor Focus
          </Badge>
        )}
      </div>

      <Progress
        value={progressValue}
        indicatorClassName={progressColor}
        className={cn(
          "h-2",
          isEmphasized && "border-amber-200 border-2"
        )}
      />

      {isEmphasized && (
        <Alert className="border-amber-200">
          <AlertDescription>
            Your advisor gave this area extra attention in your assessment
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}