"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { EngagementMetrics } from "@/lib/engagement/engagement-metrics";

type EngagementMetricsCardsProps = {
  metrics: EngagementMetrics;
};

export function EngagementMetricsCards({ metrics }: EngagementMetricsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-4">
      <Card aria-label={`Overall completion: ${metrics.overallCompletionPct}%`}>
        <CardContent className="pt-6">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Overall Completion
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-foreground">
              {metrics.overallCompletionPct}%
            </span>
          </div>
          <Progress
            value={metrics.overallCompletionPct}
            className="mt-3 h-2"
            aria-hidden
          />
        </CardContent>
      </Card>

      <Card aria-label={`Active clients: ${metrics.activeClientCount}`}>
        <CardContent className="pt-6">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Active Clients
          </p>
          <span className="mt-2 block text-3xl font-semibold text-foreground">
            {metrics.activeClientCount}
          </span>
        </CardContent>
      </Card>

      <Card aria-label={`Stalled clients: ${metrics.stalledClientCount}`}>
        <CardContent className="pt-6">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Stalled Clients
          </p>
          <span
            className={`mt-2 block text-3xl font-semibold ${
              metrics.stalledClientCount > 0
                ? "text-chart-5"
                : "text-foreground"
            }`}
          >
            {metrics.stalledClientCount}
          </span>
        </CardContent>
      </Card>

      <Card aria-label={`Overdue milestones: ${metrics.overdueMilestoneCount}`}>
        <CardContent className="pt-6">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Overdue Milestones
          </p>
          <span
            className={`mt-2 block text-3xl font-semibold ${
              metrics.overdueMilestoneCount > 0
                ? "text-destructive"
                : "text-foreground"
            }`}
          >
            {metrics.overdueMilestoneCount}
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
