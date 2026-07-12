import { cn } from "@/lib/utils";
import {
  PIPELINE_PROCESS_PHASES,
  PIPELINE_PROCESS_STATES,
  aggregatePipelineMetricsByProcessState,
  type PipelineProcessPhase,
  type PipelineProcessStateCounts,
} from "@/lib/pipeline/status";
import type { PipelineMetrics } from "@/lib/pipeline/types";

const PROCESS_SECTION_STYLES: Record<
  PipelineProcessPhase,
  { border: string; header: string }
> = {
  intake: {
    border: "border-amber-200/70 dark:border-amber-800/40",
    header: "text-amber-900 dark:text-amber-100",
  },
  assessment: {
    border: "border-orange-200/70 dark:border-orange-800/40",
    header: "text-orange-900 dark:text-orange-100",
  },
  report: {
    border: "border-emerald-200/70 dark:border-emerald-800/40",
    header: "text-emerald-900 dark:text-emerald-100",
  },
};

function ProcessStateMetric({
  state,
  value,
}: {
  state: (typeof PIPELINE_PROCESS_STATES)[number];
  value: number;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-background/70 px-2 py-2 text-center">
      <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-[11px] leading-tight text-muted-foreground">{state}</p>
    </div>
  );
}

function ProcessSection({
  process,
  counts,
}: {
  process: PipelineProcessPhase;
  counts: PipelineProcessStateCounts[PipelineProcessPhase];
}) {
  const styles = PROCESS_SECTION_STYLES[process];

  return (
    <section
      className={cn(
        "rounded-lg border bg-muted/20 p-3",
        styles.border,
      )}
      aria-label={`${process} workflow counts`}
    >
      <h3
        className={cn(
          "mb-2 text-xs font-semibold uppercase tracking-wide",
          styles.header,
        )}
      >
        {process}
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {PIPELINE_PROCESS_STATES.map((state) => (
          <ProcessStateMetric key={state} state={state} value={counts[state]} />
        ))}
      </div>
    </section>
  );
}

interface PipelineOverviewMetricsProps {
  metrics: PipelineMetrics;
  documentRequirementsEnabled?: boolean;
}

export function PipelineOverviewMetrics({
  metrics,
  documentRequirementsEnabled = true,
}: PipelineOverviewMetricsProps) {
  const processCounts = aggregatePipelineMetricsByProcessState(
    metrics.byStage,
    documentRequirementsEnabled,
  );

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {PIPELINE_PROCESS_PHASES.map((process) => (
        <ProcessSection
          key={process}
          process={process}
          counts={processCounts[process]}
        />
      ))}
    </div>
  );
}
