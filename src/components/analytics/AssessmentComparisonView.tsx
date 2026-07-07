"use client";

import { format } from "date-fns";
import { TrendIndicator } from "./TrendIndicator";
import {
  buildPillarComparisonRows,
  PillarComparisonChart,
} from "./PillarComparisonChart";
import type { AssessmentComparison } from "@/lib/analytics/types";
import { cn } from "@/lib/utils";

interface AssessmentComparisonViewProps {
  assessments: AssessmentComparison[];
}

function formatAssessmentDate(value: string): string {
  return format(new Date(value), "MMM d, yyyy");
}

export function AssessmentComparisonView({
  assessments,
}: AssessmentComparisonViewProps) {
  if (assessments.length < 2) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
        Complete another assessment to compare scores across risk domains.
      </div>
    );
  }

  const previousAssessment = assessments[assessments.length - 2];
  const currentAssessment = assessments[assessments.length - 1];
  const scoreDelta =
    currentAssessment.overallScore - previousAssessment.overallScore;
  const sameAssessment = previousAssessment.assessmentId === currentAssessment.assessmentId;
  const unchanged =
    sameAssessment || Math.abs(scoreDelta) < 0.05;

  const getTrendDirection = (): "improving" | "declining" | "stable" => {
    if (scoreDelta > 0.05) return "improving";
    if (scoreDelta < -0.05) return "declining";
    return "stable";
  };

  const comparisonRows = buildPillarComparisonRows(
    previousAssessment.categories,
    currentAssessment.categories,
  );
  const pillarsChanged = comparisonRows.filter(
    (row) => row.previous != null && Math.abs(row.delta) >= 0.05,
  ).length;

  const trend = getTrendDirection();

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border/70 bg-muted/15 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Previous
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatAssessmentDate(previousAssessment.completedAt)}
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {previousAssessment.overallScore.toFixed(1)}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              / 3 avg
            </span>
          </p>
        </div>
        <div className="rounded-lg border border-border/70 bg-muted/15 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Latest
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatAssessmentDate(currentAssessment.completedAt)}
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {currentAssessment.overallScore.toFixed(1)}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              / 3 avg
            </span>
          </p>
        </div>
      </div>

      <PillarComparisonChart rows={comparisonRows} />

      <div
        className={cn(
          "rounded-lg px-4 py-3 text-sm",
          trend === "stable"
            ? "bg-muted/40 text-muted-foreground"
            : trend === "improving"
              ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
              : "bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-200",
        )}
      >
        <div className="flex flex-wrap items-center justify-center gap-2 text-center">
          {unchanged ? (
            <span>
              Overall score unchanged at{" "}
              <span className="font-medium tabular-nums">
                {currentAssessment.overallScore.toFixed(1)}
              </span>
              {pillarsChanged === 0
                ? " — no risk domain movement between these assessments."
                : ` — ${pillarsChanged} pillar${pillarsChanged === 1 ? "" : "s"} shifted despite a flat average.`}
            </span>
          ) : (
            <>
              <span>
                Overall score moved from{" "}
                <span className="font-medium tabular-nums">
                  {previousAssessment.overallScore.toFixed(1)}
                </span>{" "}
                to{" "}
                <span className="font-medium tabular-nums">
                  {currentAssessment.overallScore.toFixed(1)}
                </span>
              </span>
              <TrendIndicator
                direction={trend}
                scoreDelta={Math.abs(scoreDelta)}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
