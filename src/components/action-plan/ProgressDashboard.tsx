"use client";

import { Progress } from "@/components/ui/progress";
import type { ActionPlanItem } from "@/lib/actions/client-action-plan-actions";

type ProgressDashboardProps = {
  items: ActionPlanItem[];
};

function taskProgress(status: string): number {
  switch (status) {
    case "NOT_STARTED":
      return 0;
    case "IN_PROGRESS":
      return 50;
    case "WAITING":
      return 50;
    case "READY_FOR_REVIEW":
      return 75;
    case "COMPLETED":
      return 100;
    default:
      return 0;
  }
}

export function ProgressDashboard({ items }: ProgressDashboardProps) {
  if (items.length === 0) return null;

  const completedCount = items.filter(
    (i) => i.taskStatus === "COMPLETED"
  ).length;
  const overallPct =
    items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  // Show progress bars for active (non-completed) items
  const activeItems = items.filter((i) => i.taskStatus !== "COMPLETED");

  return (
    <section>
      <h2 className="text-xl font-semibold font-display tracking-[-0.03em] text-foreground">
        Your Progress
      </h2>

      <div className="mt-4 space-y-6">
        {/* Overall completion */}
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-foreground">
              {overallPct}%
            </span>
            <span className="text-sm text-muted-foreground">
              overall completion ({completedCount} of {items.length})
            </span>
          </div>
          <Progress
            value={overallPct}
            className="h-3"
            role="progressbar"
            aria-valuenow={overallPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Overall action plan progress"
          />
        </div>

        {/* Per-recommendation progress bars */}
        {activeItems.length > 0 && (
          <div className="space-y-3">
            {activeItems.map((item) => {
              const pct = taskProgress(item.taskStatus);
              return (
                <div key={item.id} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm text-foreground">
                      {item.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {pct}%
                    </span>
                  </div>
                  <Progress
                    value={pct}
                    className="h-2"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Progress for ${item.name}`}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
