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
import { Target, Clock, Users } from "lucide-react";

interface ActionPlanProps {
  missingControls: MissingControl[];
  pillarName: string;
  /** Overall tier drives required action row (BRD §4.2 action mapping). */
  riskLevel: RiskLevel;
  scoreRubric?: "governance" | "cyber";
}

/**
 * Derive effort level from severity
 */
function getEffortLevel(severity: "high" | "medium" | "low"): string {
  if (severity === "high") return "Strategic";
  if (severity === "medium") return "Standard";
  return "Quick Win";
}

/**
 * Derive ownership from category
 */
function getOwnership(category: string): string {
  if (category.includes("decision") || category.includes("authority")) {
    return "Family Council";
  }
  if (category.includes("access") || category.includes("distribution")) {
    return "Financial Advisor";
  }
  if (category.includes("trust") || category.includes("legal")) {
    return "Legal Advisor";
  }
  if (category.includes("documentation") || category.includes("record")) {
    return "Family Office";
  }
  if (category.includes("behavior") || category.includes("standards")) {
    return "Family Council";
  }
  if (category.includes("succession") || category.includes("transition")) {
    return "Family Council & Advisors";
  }
  if (category.includes("business")) {
    return "Board of Directors";
  }
  if (category === "cyber-digital" || category.includes("cyber")) {
    return "IT / security lead";
  }
  return "Family Office";
}

export function ActionPlan({
  missingControls,
  pillarName,
  riskLevel,
  scoreRubric = "governance",
}: ActionPlanProps) {
  if (missingControls.length === 0) {
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

  const totalRemediationPriority = missingControls.reduce(
    (sum, c) => sum + (c.remediationPriority ?? 0),
    0
  );

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
        Recommended Actions
      </h3>
      <p className="text-sm leading-6 text-muted-foreground">
        {scoreRubric === "cyber" ? (
          <>
            Remediation steps for answers in the critical exposure or partial / inconsistent bands (0–1 on
            the {MATURITY_SCALE_MAX}-point scale). Priority total sums weighted gaps across these items.
          </>
        ) : (
          <>
            Definitive remediation steps for responses in the low-maturity band (0–1 on the{" "}
            {MATURITY_SCALE_MAX}-point scale). Priority total sums weighted gaps across these items.
          </>
        )}
      </p>

      <div className="rounded-[1.25rem] border section-divider bg-background/55 px-4 py-3 text-sm">
        <span className="font-medium text-foreground">Remediation plan priority total: </span>
        <span className="tabular-nums font-semibold text-foreground">
          {totalRemediationPriority.toFixed(1)}
        </span>
        <span className="text-muted-foreground"> (higher = more weighted attention needed)</span>
      </div>

      <div className="space-y-4">
        {missingControls.map((control, index) => {
          const priority = priorityConfig[control.severity];
          const effort = getEffortLevel(control.severity);
          const ownership = getOwnership(control.category);

          return (
            <Card key={control.questionId} className="bg-background/60">
              <CardContent className="pt-6 space-y-4">
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
                    Addresses:{" "}
                    {control.category.split("-").map((word) =>
                      word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(" ")}
                    {control.maturityScore !== undefined && (
                      <>
                        {" "}
                        · Maturity score: {control.maturityScore.toFixed(2)} / {MATURITY_SCALE_MAX}
                        {control.remediationPriority !== undefined && (
                          <> · Priority contribution: {control.remediationPriority.toFixed(1)}</>
                        )}
                      </>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-6 pl-6 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      <span className="font-medium text-foreground">{effort}</span>
                      {effort === "Quick Win" && " (days)"}
                      {effort === "Standard" && " (weeks)"}
                      {effort === "Strategic" && " (months)"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      <span className="font-medium text-foreground">{ownership}</span>
                    </span>
                  </div>
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
          These recommendations are based on your assessment responses. Consult with your advisors
          for implementation guidance.
        </p>
      </div>
    </div>
  );
}
