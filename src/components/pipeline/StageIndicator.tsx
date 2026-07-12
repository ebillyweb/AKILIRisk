"use client";

import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  getPipelineChevronPhases,
  getPipelineChevronProgress,
  getPipelineChevronStepStatus,
  PIPELINE_CHEVRON_SHORT_LABELS,
  type PipelineChevronPhase,
} from "@/lib/pipeline/status";
import type { ClientWorkflowStage } from "@prisma/client";

interface StageIndicatorProps {
  currentStage: ClientWorkflowStage;
  className?: string;
  /** Table rows: chevron process rail. Detail views can use full stepper later. */
  variant?: "bar" | "stepper";
  /** When false, omit the documents segment from workflow visuals. */
  showDocumentsStage?: boolean;
  /** When true, include the monitoring chevron (platform admin flag). */
  monitoringEnabled?: boolean;
}

const CHEVRON_STEP_STYLES: Record<
  PipelineChevronPhase,
  { complete: string; current: string; future: string }
> = {
  intake: {
    complete: "border-sky-500/35 bg-sky-500/15 text-sky-950 dark:text-sky-100",
    current:
      "border-sky-600/50 bg-sky-500/20 text-sky-950 ring-1 ring-sky-500/35 dark:text-sky-50",
    future: "border-border/70 bg-muted/30 text-muted-foreground",
  },
  assessment: {
    complete:
      "border-amber-500/35 bg-amber-500/15 text-amber-950 dark:text-amber-100",
    current:
      "border-amber-600/50 bg-amber-500/20 text-amber-950 ring-1 ring-amber-500/35 dark:text-amber-50",
    future: "border-border/70 bg-muted/30 text-muted-foreground",
  },
  report: {
    complete:
      "border-emerald-500/35 bg-emerald-500/15 text-emerald-950 dark:text-emerald-100",
    current:
      "border-emerald-600/50 bg-emerald-500/20 text-emerald-950 ring-1 ring-emerald-500/35 dark:text-emerald-50",
    future: "border-border/70 bg-muted/30 text-muted-foreground",
  },
  monitoring: {
    complete:
      "border-violet-500/35 bg-violet-500/15 text-violet-950 dark:text-violet-100",
    current:
      "border-violet-600/50 bg-violet-500/20 text-violet-950 ring-1 ring-violet-500/35 dark:text-violet-50",
    future: "border-border/70 bg-muted/30 text-muted-foreground",
  },
};

/** Compact intake → assessment → report (+ monitoring) chevron rail for pipeline rows. */
export function StageProgressBar({
  currentStage,
  className,
  showDocumentsStage = true,
  monitoringEnabled = false,
}: Pick<
  StageIndicatorProps,
  "currentStage" | "className" | "showDocumentsStage" | "monitoringEnabled"
>) {
  const phases = getPipelineChevronPhases(monitoringEnabled);
  const progress = getPipelineChevronProgress(
    currentStage,
    showDocumentsStage,
    monitoringEnabled,
  );
  const activePhase = phases[progress.activeIndex] ?? phases[0]!;

  return (
    <div
      className={cn("flex min-w-0 items-center", className)}
      role="img"
      aria-label={`Workflow progress: ${PIPELINE_CHEVRON_SHORT_LABELS[activePhase]}`}
    >
      {phases.map((phase, index) => {
        const stepStatus = getPipelineChevronStepStatus(index, progress);
        const styles = CHEVRON_STEP_STYLES[phase][stepStatus];

        return (
          <div key={phase} className="flex min-w-0 flex-1 items-center">
            <div
              title={PIPELINE_CHEVRON_SHORT_LABELS[phase]}
              className={cn(
                "flex h-5 min-w-0 flex-1 items-center justify-center truncate rounded-md border px-1 text-[9px] font-medium leading-none sm:text-[10px]",
                styles,
              )}
            >
              <span className="truncate">{PIPELINE_CHEVRON_SHORT_LABELS[phase]}</span>
            </div>
            {index < phases.length - 1 ? (
              <ChevronRight
                className="mx-0.5 size-3 shrink-0 text-muted-foreground/45"
                aria-hidden
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Full stepper with labels — use outside cramped tables if needed. */
function StageStepper({
  currentStage,
  className,
  showDocumentsStage = true,
  monitoringEnabled = false,
}: Pick<
  StageIndicatorProps,
  "currentStage" | "className" | "showDocumentsStage" | "monitoringEnabled"
>) {
  const phases = getPipelineChevronPhases(monitoringEnabled);
  const progress = getPipelineChevronProgress(
    currentStage,
    showDocumentsStage,
    monitoringEnabled,
  );

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {phases.map((phase, index) => {
        const stepStatus = getPipelineChevronStepStatus(index, progress);
        const isCompleted = stepStatus === "complete";
        const isCurrent = stepStatus === "current";

        return (
          <div key={phase} className="flex items-center">
            <div
              className="flex flex-col items-center gap-0.5"
              title={PIPELINE_CHEVRON_SHORT_LABELS[phase]}
            >
              <div
                className={cn(
                  "flex h-2.5 w-2.5 items-center justify-center rounded-full text-[0.5rem] font-medium transition-colors",
                  isCompleted && "bg-primary text-primary-foreground",
                  isCurrent &&
                    "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-1",
                  stepStatus === "future" &&
                    "border border-muted-foreground/25 bg-muted",
                )}
              >
                {isCompleted ? "✓" : null}
              </div>
              <span className="text-[0.6rem] leading-none text-muted-foreground">
                {PIPELINE_CHEVRON_SHORT_LABELS[phase]}
              </span>
            </div>
            {index < phases.length - 1 ? (
              <div
                className={cn(
                  "mx-0.5 h-px w-2 transition-colors",
                  isCompleted ? "bg-primary" : "bg-muted-foreground/20",
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
  showDocumentsStage = true,
  monitoringEnabled = false,
}: StageIndicatorProps) {
  if (variant === "stepper") {
    return (
      <StageStepper
        currentStage={currentStage}
        className={className}
        showDocumentsStage={showDocumentsStage}
        monitoringEnabled={monitoringEnabled}
      />
    );
  }

  return (
    <StageProgressBar
      currentStage={currentStage}
      className={className}
      showDocumentsStage={showDocumentsStage}
      monitoringEnabled={monitoringEnabled}
    />
  );
}
