"use client";

import { cn } from "@/lib/utils";
import {
  getAdvisorPipelineProcessLabel,
  getAdvisorPipelineProcessStateLabel,
} from "@/lib/pipeline/status";
import type { ClientWorkflowStage } from "@/lib/pipeline/types";

interface PipelineProcessStateLabelProps {
  stage: ClientWorkflowStage;
  documentRequirementsEnabled?: boolean;
  className?: string;
  processClassName?: string;
  stateClassName?: string;
  /** When set, only render the process phase (intake, assessment, report). */
  show?: "both" | "process" | "state";
}

export function PipelineProcessStateLabel({
  stage,
  documentRequirementsEnabled = true,
  className,
  processClassName,
  stateClassName,
  show = "both",
}: PipelineProcessStateLabelProps) {
  const process = getAdvisorPipelineProcessLabel(stage, documentRequirementsEnabled);
  const state = getAdvisorPipelineProcessStateLabel(stage, documentRequirementsEnabled);

  if (show === "process") {
    return (
      <span className={cn("capitalize", processClassName, className)}>{process}</span>
    );
  }

  if (show === "state") {
    return (
      <span className={cn("text-muted-foreground", stateClassName, className)}>
        {state}
      </span>
    );
  }

  return (
    <span className={className}>
      <span className={cn("capitalize", processClassName)}>{process}</span>
      <span className={cn("text-muted-foreground", stateClassName)}> · {state}</span>
    </span>
  );
}
