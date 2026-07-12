"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getAdvisorPipelineProcessLabel,
  getAdvisorPipelineProcessStateLabel,
  type PipelineProcessPhase,
  type PipelineProcessState,
} from "@/lib/pipeline/status";
import type { ClientWorkflowStage } from "@/lib/pipeline/types";

const COMPACT_BADGE_CLASS =
  "h-5 max-w-full truncate rounded-md px-2 py-0 text-[10px] font-medium normal-case tracking-normal";

const PROCESS_BADGE_STYLES: Record<
  PipelineProcessPhase,
  { variant?: "outline" | "info" | "warning" | "success"; className?: string }
> = {
  intake: {
    variant: "outline",
    className:
      "border-sky-500/30 bg-sky-500/10 text-sky-950 dark:border-sky-400/25 dark:bg-sky-500/15 dark:text-sky-100",
  },
  assessment: {
    variant: "outline",
    className:
      "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:border-amber-400/25 dark:bg-amber-500/15 dark:text-amber-100",
  },
  report: {
    variant: "outline",
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:border-emerald-400/25 dark:bg-emerald-500/15 dark:text-emerald-100",
  },
};

const STATE_BADGE_STYLES: Record<
  PipelineProcessState | "stalled",
  { variant?: "outline" | "info" | "warning" | "success"; className?: string }
> = {
  "not started": {
    variant: "outline",
    className: "border-border/80 bg-muted/40 text-muted-foreground",
  },
  "in progress": {
    variant: "outline",
    className:
      "border-brand/25 bg-brand/10 text-foreground dark:border-brand/30 dark:bg-brand/15",
  },
  complete: {
    variant: "outline",
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:border-emerald-400/25 dark:bg-emerald-500/15 dark:text-emerald-100",
  },
  stalled: {
    variant: "warning",
    className: "border-amber-500/35 bg-amber-500/15 text-amber-950 dark:text-amber-50",
  },
};

interface PipelineProcessStateLabelProps {
  stage: ClientWorkflowStage;
  documentRequirementsEnabled?: boolean;
  className?: string;
  /** When true, show stalled in the state slot instead of not started / in progress / complete. */
  stalled?: boolean;
  /** When set, only render the process phase or workflow state. */
  show?: "both" | "process" | "state";
}

function PipelineProcessBadge({
  process,
  className,
}: {
  process: PipelineProcessPhase;
  className?: string;
}) {
  const styles = PROCESS_BADGE_STYLES[process];

  return (
    <Badge
      variant={styles.variant ?? "outline"}
      className={cn(COMPACT_BADGE_CLASS, styles.className, className)}
    >
      {process}
    </Badge>
  );
}

function PipelineStateBadge({
  state,
  className,
}: {
  state: PipelineProcessState | "stalled";
  className?: string;
}) {
  const styles = STATE_BADGE_STYLES[state];

  return (
    <Badge
      variant={styles.variant ?? "outline"}
      className={cn(COMPACT_BADGE_CLASS, styles.className, className)}
    >
      {state}
    </Badge>
  );
}

export function PipelineProcessStateLabel({
  stage,
  documentRequirementsEnabled = true,
  className,
  stalled = false,
  show = "both",
}: PipelineProcessStateLabelProps) {
  const process = getAdvisorPipelineProcessLabel(
    stage,
    documentRequirementsEnabled,
  ) as PipelineProcessPhase;
  const state = getAdvisorPipelineProcessStateLabel(
    stage,
    documentRequirementsEnabled,
  ) as PipelineProcessState;
  const stateKey = stalled ? "stalled" : state;

  if (show === "process") {
    return <PipelineProcessBadge process={process} className={className} />;
  }

  if (show === "state") {
    return <PipelineStateBadge state={stateKey} className={className} />;
  }

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      <PipelineProcessBadge process={process} />
      <PipelineStateBadge state={stateKey} />
    </span>
  );
}
