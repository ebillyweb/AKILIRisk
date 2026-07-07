"use client";

import { useTransition, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CircleDollarSign,
  Clock,
  Building2,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";
import { extractRecommendationReasons } from "@/lib/recommendations/format-trigger";
import type {
  ActionPlanItem,
  TaskStatus,
} from "@/lib/actions/client-action-plan-actions";
import { updateTaskStatus } from "@/lib/actions/client-action-plan-actions";

type ActionCardProps = {
  item: ActionPlanItem;
  showCadence?: boolean;
};

const TASK_STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "NOT_STARTED", label: "Not Started" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "WAITING", label: "Waiting on Someone Else" },
  { value: "READY_FOR_REVIEW", label: "Ready for Review" },
  { value: "COMPLETED", label: "Completed" },
];

function validationBadge(
  status: string | null
): { label: string; variant: "outline" | "success" | "warning" } | null {
  switch (status) {
    case "PENDING_REVIEW":
      return { label: "Pending Review", variant: "outline" };
    case "VERIFIED":
      return { label: "Verified", variant: "success" };
    case "NEEDS_FOLLOWUP":
      return { label: "Needs Follow-up", variant: "warning" };
    default:
      return null;
  }
}

export function ActionCard({ item, showCadence }: ActionCardProps) {
  const [isPending, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useState<TaskStatus>(
    item.taskStatus
  );
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  const handleStatusChange = (value: string) => {
    const newStatus = value as TaskStatus;
    setOptimisticStatus(newStatus);
    startTransition(async () => {
      await updateTaskStatus({
        recommendationId: item.id,
        taskStatus: newStatus,
      });
    });
  };

  const handleMarkComplete = () => {
    setOptimisticStatus("COMPLETED");
    startTransition(async () => {
      await updateTaskStatus({
        recommendationId: item.id,
        taskStatus: "COMPLETED",
      });
    });
  };

  const valBadge = item.requiresValidation
    ? validationBadge(item.validationStatus)
    : null;

  const recommendationReasons =
    item.recommendationReasons.length > 0
      ? item.recommendationReasons
      : extractRecommendationReasons(item.triggerReason);
  const reasonsPreview = recommendationReasons.join(" ");

  return (
    <Card className="bg-background/60">
      <CardContent className="space-y-4 pt-6">
        {/* Header: title + status */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="text-xl font-semibold text-foreground">
            {item.name}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {/* Task status selector */}
            <div aria-live="polite">
              <Select
                value={optimisticStatus}
                onValueChange={handleStatusChange}
                disabled={isPending}
              >
                <SelectTrigger className="h-8 w-[200px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Validation status badge (read-only, advisor-managed) */}
            {valBadge ? (
              <Badge variant={valBadge.variant} className="text-xs">
                {valBadge.label}
              </Badge>
            ) : null}
          </div>
        </div>

        {/* Role badges and assignees */}
        {(item.responsibleRoles.length > 0 ||
          item.assignees.length > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {item.responsibleRoles.map((role) => (
              <Badge key={role} variant="outline" className="text-xs">
                {role}
              </Badge>
            ))}
            {item.assignees.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Assigned to: {item.assignees.join(", ")}
              </span>
            )}
          </div>
        )}

        {/* Cadence for ongoing items */}
        {showCadence && item.timeframe ? (
          <p className="text-xs text-muted-foreground">
            Cadence: {item.timeframe}
          </p>
        ) : null}

        {/* --- Reasoning Chain (D-19) --- */}

        {/* Why this was recommended */}
        {recommendationReasons.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Why this was recommended
            </p>
            <Collapsible open={evidenceOpen} onOpenChange={setEvidenceOpen}>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground/90 leading-relaxed">
                {(evidenceOpen
                  ? recommendationReasons
                  : recommendationReasons.slice(0, 2)
                ).map((reason, index) => (
                  <li
                    key={`${index}-${reason}`}
                    className={!evidenceOpen && index === 0 ? "line-clamp-2" : undefined}
                  >
                    {reason}
                  </li>
                ))}
              </ul>
              {(reasonsPreview.length > 120 ||
                recommendationReasons.length > 2) && (
                <CollapsibleTrigger className="mt-1 text-xs text-muted-foreground hover:text-foreground">
                  {evidenceOpen ? "Show less" : "Show more"}
                </CollapsibleTrigger>
              )}
              <CollapsibleContent />
            </Collapsible>
          </div>
        )}

        {/* Expected Benefit */}
        {item.expectedOutcome && (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Expected Benefit
            </p>
            <p className="text-sm text-foreground/90 leading-relaxed">
              {item.expectedOutcome}
            </p>
          </div>
        )}

        {/* Supporting Insights */}
        {item.category && (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Supporting Insights
            </p>
            <p className="text-sm text-muted-foreground">
              Based on your {item.category} assessment findings
            </p>
          </div>
        )}

        {/* Implementation Guidance (collapsible) */}
        {item.playbookSteps.length > 0 && (
          <Collapsible open={guidanceOpen} onOpenChange={setGuidanceOpen}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-muted/40">
              <span>Implementation Guidance ({item.playbookSteps.length} steps)</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  guidanceOpen ? "rotate-180" : ""
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ol className="mt-2 space-y-2 pl-1">
                {item.playbookSteps.map((step, idx) => (
                  <li
                    key={idx}
                    className="flex gap-3 rounded-md border border-border/40 bg-muted/10 p-3"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-medium text-foreground">
                        {step.title}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {step.description}
                      </p>
                      {step.estimatedDuration && (
                        <p className="text-xs text-muted-foreground/70">
                          Est. {step.estimatedDuration}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Success Criteria */}
        {(item.description || item.expectedOutcome) && (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Success Criteria
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {item.expectedOutcome
                ? `${item.expectedOutcome}`
                : item.description}
            </p>
          </div>
        )}

        {/* Detail grid: cost, timeframe, provider */}
        {(item.estimatedCost || item.timeframe || item.provider) && (
          <div className="grid gap-3 rounded-[1rem] border section-divider bg-background/55 p-4 text-sm sm:grid-cols-2">
            {item.estimatedCost && (
              <div className="flex items-start gap-2">
                <CircleDollarSign className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium text-foreground">
                    Estimated investment
                  </p>
                  <p className="text-muted-foreground">
                    {item.estimatedCost}
                  </p>
                </div>
              </div>
            )}
            {item.timeframe && !showCadence && (
              <div className="flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium text-foreground">
                    Timeframe
                  </p>
                  <p className="text-muted-foreground">{item.timeframe}</p>
                </div>
              </div>
            )}
            {item.provider && (
              <div className="flex items-start gap-2 sm:col-span-2">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium text-foreground">
                    Provider
                  </p>
                  <p className="text-muted-foreground">{item.provider}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mark Complete shortcut */}
        {optimisticStatus !== "COMPLETED" && (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkComplete}
              disabled={isPending}
              className="gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              Mark Complete
            </Button>
            {item.requiresValidation && (
              <span className="text-xs text-muted-foreground">
                Your advisor will verify this completion.
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
