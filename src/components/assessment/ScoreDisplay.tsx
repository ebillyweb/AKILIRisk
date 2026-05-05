/**
 * ScoreDisplay Component
 *
 * Shows Belvedere-style resilience score (0–100) from maturity (0–3), tier label, and breakdown.
 */

import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { CategoryScore, RiskLevel } from "@/lib/assessment/types";
import { MATURITY_SCALE_MAX } from "@/lib/assessment/maturity-scale";
import {
  governanceTierCopyForRiskLevel,
  maturityHeatLevel,
  maturityScoreToPercent,
} from "@/lib/assessment/governance-rubric";
import { cyberTierCopyForRiskLevel } from "@/lib/cyber-risk/cyber-rubric";

interface ScoreDisplayProps {
  score: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  breakdown: CategoryScore[];
  answeredPercentage: number;
  /** When the scored scope is cyber-only (e.g. advisor focus), use cyber tier copy and labels. */
  scoreRubric?: "governance" | "cyber";
}

function toRiskLevelKey(level: ScoreDisplayProps["riskLevel"]): RiskLevel {
  return level.toLowerCase() as RiskLevel;
}

export function ScoreDisplay({
  score,
  riskLevel,
  breakdown,
  answeredPercentage,
  scoreRubric = "governance",
}: ScoreDisplayProps) {
  const tierKey = toRiskLevelKey(riskLevel);
  const tier =
    scoreRubric === "cyber"
      ? cyberTierCopyForRiskLevel(tierKey)
      : governanceTierCopyForRiskLevel(tierKey);
  const resiliencePercent = maturityScoreToPercent(score);

  const riskLevelConfig = {
    LOW: {
      badge: "success" as const,
      progressColor: "bg-green-600",
    },
    MEDIUM: {
      badge: "warning" as const,
      progressColor: "bg-amber-500",
    },
    HIGH: {
      badge: "warning" as const,
      progressColor: "bg-orange-600",
    },
    CRITICAL: {
      badge: "outline" as const,
      progressColor: "bg-red-600",
    },
  };

  const config = riskLevelConfig[riskLevel];

  const categoryBarClass = (maturity03: number) => {
    const heat = maturityHeatLevel(maturity03);
    if (heat === "strong") return "bg-green-600";
    if (heat === "fair") return "bg-amber-500";
    if (heat === "weak") return "bg-orange-600";
    return "bg-red-600";
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <p className="editorial-kicker">Assessment Summary</p>
        <div>
          <div className="text-5xl font-bold text-foreground sm:text-6xl">
            {resiliencePercent}
            <span className="text-3xl text-muted-foreground"> / 100</span>
          </div>
          <p className="mt-2 text-lg text-muted-foreground">
            {scoreRubric === "cyber" ? "Cyber resilience" : "Governance resilience"} score (maturity{" "}
            {score.toFixed(1)} / {MATURITY_SCALE_MAX})
          </p>
        </div>

        <div className="flex flex-col items-center gap-1">
          <Badge variant={config.badge} className="px-4 py-2 text-sm font-medium">
            {tier.title}
          </Badge>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">{tier.description}</p>
        </div>

        <div className="max-w-2xl mx-auto">
          <Progress
            value={resiliencePercent}
            className="h-3"
            indicatorClassName={config.progressColor}
          />
        </div>

        <p className="text-xs text-muted-foreground max-w-xl mx-auto">
          Risk tiers reflect the resilience score relative to configured cutoffs.
        </p>

        {answeredPercentage < 100 && (
          <p className="text-sm italic text-muted-foreground">
            Based on {Math.round(answeredPercentage)}% of questions answered.
            Complete remaining questions for full accuracy.
          </p>
        )}
      </div>

      <div className="border-t section-divider pt-6">
        <h3 className="text-2xl font-semibold text-foreground mb-4">
          {scoreRubric === "cyber" ? "Cyber security category assessment" : "Governance category assessment"}
        </h3>
        <div className="space-y-4">
          {breakdown.map((category) => (
            <div
              key={category.categoryId}
              className="space-y-2 rounded-[1.25rem] border section-divider bg-background/55 px-4 py-4"
            >
              <div className="flex justify-between items-baseline gap-2">
                <span className="text-sm font-medium text-foreground">
                  {category.categoryName}
                </span>
                <span className="text-sm font-semibold text-foreground tabular-nums shrink-0">
                  {maturityScoreToPercent(category.score)} / 100
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    ({category.score.toFixed(1)} / {category.maxScore})
                  </span>
                </span>
              </div>
              <Progress
                value={maturityScoreToPercent(category.score)}
                className="h-2"
                indicatorClassName={categoryBarClass(category.score)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
