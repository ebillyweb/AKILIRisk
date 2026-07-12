"use client";

import { PipelineChevronTrack } from "./PipelineChevronTrack";
import type { ClientWorkflowStage } from "@prisma/client";
import { cn } from "@/lib/utils";

interface StageIndicatorProps {
  currentStage: ClientWorkflowStage;
  className?: string;
  variant?: "bar" | "stepper";
  showDocumentsStage?: boolean;
  monitoringEnabled?: boolean;
}

/** Compact chevron process rail (delegates to PipelineChevronTrack). */
export function StageProgressBar({
  currentStage,
  className,
  showDocumentsStage = true,
  monitoringEnabled = false,
}: Pick<
  StageIndicatorProps,
  "currentStage" | "className" | "showDocumentsStage" | "monitoringEnabled"
>) {
  return (
    <PipelineChevronTrack
      currentStage={currentStage}
      showDocumentsStage={showDocumentsStage}
      monitoringEnabled={monitoringEnabled}
      className={cn(className)}
    />
  );
}

export function StageIndicator({
  currentStage,
  className,
  variant = "bar",
  showDocumentsStage = true,
  monitoringEnabled = false,
}: StageIndicatorProps) {
  return (
    <StageProgressBar
      currentStage={currentStage}
      className={className}
      showDocumentsStage={showDocumentsStage}
      monitoringEnabled={monitoringEnabled}
    />
  );
}
