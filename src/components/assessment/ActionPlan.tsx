/**
 * ActionPlan Component
 *
 * Displays prioritized action recommendations with ownership and effort guidance.
 * Derives implementation details from missing control severity and category.
 */

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { MissingControl, RiskLevel } from "@/lib/assessment/types";
import { MATURITY_SCALE_MAX } from "@/lib/assessment/maturity-scale";
import { governanceTierCopyForRiskLevel } from "@/lib/assessment/governance-rubric";
import { cyberTierCopyForRiskLevel } from "@/lib/cyber-risk/cyber-rubric";
import { Target } from "lucide-react";
import { PillarNarrativeSummary } from "@/components/assessment/PillarNarrativeSummary";
import type { ActionPlanDepth } from "@/lib/assessment/plan-depth";

interface ActionPlanProps {
  missingControls: MissingControl[];
  pillarName: string;
  /** Overall tier drives required action row (BRD §4.2 action mapping). */
  riskLevel: RiskLevel;
  scoreRubric?: "governance" | "cyber";
  /** Canonical all-no / all-yes pillar narrative (empty for mixed maturity). */
  pillarNarratives?: string[];
  /** PROFILE: what to address. PORTFOLIO: same summary; execution detail lives in FacilitatedRecommendations. */
  planDepth?: ActionPlanDepth;
}

function formatCategoryLabel(category: string): string {
  return category
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function ActionPlan({
  missingControls,
  pillarName: _pillarName,
  riskLevel,
  scoreRubric = "governance",
  pillarNarratives = [],
  planDepth = "profile",
}: ActionPlanProps) {
  const isPortfolio = planDepth === "portfolio";
  const narrativeVariant =
    riskLevel === "low"
      ? ("positive" as const)
      : riskLevel === "medium"
        ? ("developing" as const)
        : ("critical" as const);

  if (missingControls.length === 0) {
    if (pillarNarratives.length > 0) {
      return (
        <div className="space-y-4">
          <h3 className="text-2xl font-semibold text-foreground">
            Recommended Actions
          </h3>
          <PillarNarrativeSummary
            narratives={pillarNarratives}
            variant={narrativeVariant}
          />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <h3 className="text-2xl font-semibold text-foreground">
          Recommended Actions
        </h3>
        <Card className="border-emerald-500/20 bg-emerald-500/10">
          <CardContent className="pt-6">
            <p className="font-medium text-emerald-900 dark:text-emerald-100">
              {scoreRubric === "cyber"
                ? "Your cyber security posture looks strong for the areas assessed."
                : "Your governance framework is well-established."}
            </p>
            <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-200">
              {scoreRubric === "cyber"
                ? "Keep testing backups, phishing awareness, and access reviews on a regular cadence."
                : "Continue regular reviews and updates to maintain strong governance practices."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const priorityConfig = {
    high: {
      badge: "outline" as const,
      label: "High Priority",
    },
    medium: {
      badge: "warning" as const,
      label: "Medium Priority",
    },
    low: {
      badge: "secondary" as const,
      label: "Low Priority",
    },
  };

  return (
    <div className="space-y-4">
      <h3 className="text-2xl font-semibold text-foreground">
        {isPortfolio ? "Assessment remediation priorities" : "Recommended actions"}
      </h3>
      {pillarNarratives.length > 0 ? (
        <PillarNarrativeSummary
          narratives={pillarNarratives}
          variant={narrativeVariant}
        />
      ) : null}
      <p className="text-sm leading-6 text-muted-foreground">
        {scoreRubric === "cyber" ? (
          <>
            Priority gaps from answers in the critical exposure or partial / inconsistent bands (0–1 on
            the {MATURITY_SCALE_MAX}-point scale).
          </>
        ) : (
          <>
            Priority gaps from responses in the low-maturity band (0–1 on the{" "}
            {MATURITY_SCALE_MAX}-point scale).
          </>
        )}
      </p>

      <div className="space-y-4">
        {missingControls.map((control, index) => {
          const priority = priorityConfig[control.severity];

          return (
            <Card key={control.questionId} className="bg-background/60">
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                      <Target className="w-4 h-4 text-brand" />
                      Action {index + 1}: {control.recommendation}
                    </h4>
                    <Badge variant={priority.badge} className="text-xs flex-shrink-0">
                      {priority.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground pl-6">
                    Addresses: {formatCategoryLabel(control.category)}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 space-y-3 rounded-[1.25rem] border section-divider bg-background/55 p-4">
        <div>
          <p className="text-xs font-medium text-foreground">Tier required action</p>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            {(scoreRubric === "cyber" ? cyberTierCopyForRiskLevel : governanceTierCopyForRiskLevel)(
              riskLevel
            ).requiredAction}
          </p>
        </div>
        <p className="text-xs text-muted-foreground border-t border-border/60 pt-3">
          {isPortfolio
            ? "These priorities reflect your assessment responses. Facilitated execution options for matched advisory services appear below."
            : "These recommendations are based on your assessment responses. Your advisor will help prioritize next steps; detailed implementation planning unlocks in your Risk Portfolio."}
        </p>
      </div>
    </div>
  );
}
