"use client";

import { AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type MilestoneInfo = {
  title: string;
  dueDate: Date | null;
  recommendationName: string;
};

const TERMINAL_STATUSES = ["COMPLETED", "SKIPPED", "DEFERRED"];

export function NextStepCallout({
  milestones,
  milestoneStatuses,
}: {
  milestones: MilestoneInfo[];
  milestoneStatuses?: string[];
}) {
  // Filter to non-terminal milestones
  const active = milestones.filter(
    (_, i) => !milestoneStatuses || !TERMINAL_STATUSES.includes(milestoneStatuses[i])
  );

  if (active.length === 0) return null;

  // Prefer milestone with earliest due date
  const nextStep = active.reduce((best, current) => {
    if (!best.dueDate && current.dueDate) return current;
    if (best.dueDate && current.dueDate && current.dueDate < best.dueDate)
      return current;
    return best;
  }, active[0]);

  return (
    <Card
      className="border-l-[3px] border-l-brand p-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 shrink-0 text-brand mt-0.5" />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Next Step</h3>
          <p className="mt-1 text-sm text-foreground">{nextStep.title}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {nextStep.recommendationName}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {nextStep.dueDate
                ? `Due ${format(nextStep.dueDate, "MMM d")}`
                : "No due date"}
            </Badge>
          </div>
        </div>
      </div>
    </Card>
  );
}
