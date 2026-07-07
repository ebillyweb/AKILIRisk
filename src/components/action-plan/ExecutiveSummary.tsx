"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ActionPlanItem } from "@/lib/actions/client-action-plan-actions";
import { format } from "date-fns";

type ExecutiveSummaryProps = {
  items: ActionPlanItem[];
};

function statusBadgeVariant(
  status: string
): "default" | "secondary" | "outline" | "success" | "warning" {
  switch (status) {
    case "COMPLETED":
      return "success";
    case "IN_PROGRESS":
      return "warning";
    case "READY_FOR_REVIEW":
      return "secondary";
    default:
      return "outline";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "NOT_STARTED":
      return "Not Started";
    case "IN_PROGRESS":
      return "In Progress";
    case "WAITING":
      return "Waiting on Someone Else";
    case "READY_FOR_REVIEW":
      return "Ready for Review";
    case "COMPLETED":
      return "Completed";
    default:
      return status;
  }
}

export function ExecutiveSummary({ items }: ExecutiveSummaryProps) {
  // Calculate readiness score: average urgency (inverted so lower urgency = higher readiness)
  const avgUrgency =
    items.length > 0
      ? items.reduce((sum, i) => sum + i.urgencyScore, 0) / items.length
      : 0;
  // Scale: urgency 1-10 maps to readiness 100-0
  const readinessScore = Math.round(Math.max(0, Math.min(100, (1 - avgUrgency / 10) * 100)));

  // Top 3 by urgency (highest urgency = lowest score number)
  const topPriorities = [...items]
    .sort((a, b) => a.urgencyScore - b.urgencyScore)
    .slice(0, 3);

  // Completed count
  const completedCount = items.filter(
    (i) => i.taskStatus === "COMPLETED"
  ).length;

  // Next review date
  const reviewDates = items
    .filter((i) => i.deferredRevisitDate)
    .map((i) => new Date(i.deferredRevisitDate!))
    .filter((d) => !isNaN(d.getTime()) && d > new Date())
    .sort((a, b) => a.getTime() - b.getTime());
  const nextReview = reviewDates.length > 0 ? reviewDates[0] : null;

  return (
    <Card className="rounded-xl border border-border/70 bg-card/60 shadow-sm ring-1 ring-border/30">
      <CardContent className="p-5 sm:p-6">
        <h2 className="text-xl font-semibold font-display tracking-[-0.03em] text-foreground">
          Where you stand today
        </h2>

        <div className="mt-4 grid gap-6 sm:grid-cols-3">
          {/* Readiness Score */}
          <div className="flex flex-col items-center justify-center rounded-lg bg-muted/30 p-4">
            <span className="font-display text-4xl font-semibold text-foreground">
              {readinessScore}
            </span>
            <span className="mt-1 text-xs text-muted-foreground">
              Readiness Score
            </span>
          </div>

          {/* Top Priorities */}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Top Priorities
            </p>
            {topPriorities.length > 0 ? (
              <ul className="space-y-1.5">
                {topPriorities.map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
                    <span className="truncate text-sm text-foreground">
                      {item.name}
                    </span>
                    <Badge
                      variant={statusBadgeVariant(item.taskStatus)}
                      className="shrink-0 text-xs"
                    >
                      {statusLabel(item.taskStatus)}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No priorities yet
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Completed
              </p>
              <p className="text-sm text-foreground">
                {completedCount} action{completedCount !== 1 ? "s" : ""}{" "}
                completed
              </p>
            </div>
            {nextReview ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Next Review
                </p>
                <p className="text-sm text-foreground">
                  {format(nextReview, "MMM d, yyyy")}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
