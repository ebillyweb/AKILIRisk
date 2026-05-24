"use client";

import { cn } from "@/lib/utils";
import { getStageOrder } from "@/lib/pipeline/status";
import type { ClientWorkflowStage } from "@prisma/client";

interface StageIndicatorProps {
  currentStage: ClientWorkflowStage;
  className?: string;
  /** Table rows: badge + segment bar. Detail views can use full stepper later. */
  variant?: "bar" | "stepper";
}

const WORKFLOW_SEGMENTS: {
  stage: ClientWorkflowStage;
  label: string;
  shortLabel: string;
}[] = [
  { stage: "INVITED", label: "Invited", shortLabel: "Inv" },
  { stage: "REGISTERED", label: "Registered", shortLabel: "Reg" },
  { stage: "INTAKE_IN_PROGRESS", label: "Intake", shortLabel: "Intake" },
  {
    stage: "ASSESSMENT_IN_PROGRESS",
    label: "Assessment",
    shortLabel: "Assess",
  },
  { stage: "DOCUMENTS_REQUIRED", label: "Documents", shortLabel: "Docs" },
  { stage: "COMPLETE", label: "Complete", shortLabel: "Done" },
];

/** Slim segmented bar for pipeline table rows. */
export function StageProgressBar({
  currentStage,
  className,
}: Pick<StageIndicatorProps, "currentStage" | "className">) {
  const currentOrder = getStageOrder(currentStage);

  return (
    <div
      className={cn("flex w-full max-w-[9.5rem] gap-0.5", className)}
      role="img"
      aria-label={`Workflow progress: ${WORKFLOW_SEGMENTS.find((s) => getStageOrder(s.stage) === currentOrder)?.label ?? currentStage}`}
    >
      {WORKFLOW_SEGMENTS.map((segment) => {
        const segmentOrder = getStageOrder(segment.stage);
        const isComplete = segmentOrder < currentOrder;
        const isCurrent = segmentOrder === currentOrder;

        return (
          <div
            key={segment.stage}
            title={segment.label}
            className={cn(
              "h-1.5 min-w-0 flex-1 rounded-full transition-colors",
              isComplete && "bg-primary",
              isCurrent && "bg-primary ring-1 ring-primary/40 ring-offset-1",
              !isComplete &&
                !isCurrent &&
                "bg-muted-foreground/15"
            )}
          />
        );
      })}
    </div>
  );
}

/** Full stepper with labels — use outside cramped tables if needed. */
function StageStepper({
  currentStage,
  className,
}: Pick<StageIndicatorProps, "currentStage" | "className">) {
  const currentOrder = getStageOrder(currentStage);

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {WORKFLOW_SEGMENTS.map((segment, index) => {
        const segmentOrder = getStageOrder(segment.stage);
        const isCompleted = segmentOrder < currentOrder;
        const isCurrent = segmentOrder === currentOrder;
        const isFuture = segmentOrder > currentOrder;

        return (
          <div key={segment.stage} className="flex items-center">
            <div
              className="flex flex-col items-center gap-0.5"
              title={segment.label}
            >
              <div
                className={cn(
                  "flex h-2.5 w-2.5 items-center justify-center rounded-full text-[0.5rem] font-medium transition-colors",
                  isCompleted && "bg-primary text-primary-foreground",
                  isCurrent &&
                    "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-1",
                  isFuture &&
                    "border border-muted-foreground/25 bg-muted"
                )}
              >
                {isCompleted ? "✓" : null}
              </div>
              <span className="text-[0.6rem] leading-none text-muted-foreground">
                {segment.shortLabel}
              </span>
            </div>
            {index < WORKFLOW_SEGMENTS.length - 1 ? (
              <div
                className={cn(
                  "mx-0.5 h-px w-2 transition-colors",
                  isCompleted ? "bg-primary" : "bg-muted-foreground/20"
                )}
                aria-hidden
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function StageIndicator({
  currentStage,
  className,
  variant = "bar",
}: StageIndicatorProps) {
  if (variant === "stepper") {
    return <StageStepper currentStage={currentStage} className={className} />;
  }

  return (
    <StageProgressBar currentStage={currentStage} className={className} />
  );
}
