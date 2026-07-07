import type { GuidancePackageSummary } from "@/lib/recommendations/types";
import { cn } from "@/lib/utils";

type StatProps = {
  value: number;
  label: string;
  emphasis?: "default" | "primary" | "muted";
};

function Stat({ value, label, emphasis = "default" }: StatProps) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
      <span
        className={cn(
          "text-base font-semibold tabular-nums leading-none sm:text-lg",
          emphasis === "primary" && "text-primary",
          emphasis === "muted" && "text-muted-foreground",
          emphasis === "default" && "text-foreground"
        )}
      >
        {value}
      </span>
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-[11px]">
        {label}
      </span>
    </div>
  );
}

export function GuidanceSummaryStrip({
  summary,
}: {
  summary: GuidancePackageSummary;
}) {
  return (
    <div
      className="grid grid-cols-3 gap-2 sm:grid-cols-6"
      aria-label="Guidance package summary"
    >
      <Stat value={summary.totalItems} label="Total" />
      <Stat value={summary.includedCount} label="Included" emphasis="primary" />
      <Stat value={summary.deferredCount} label="Deferred" />
      <Stat
        value={summary.completedCount}
        label="Completed"
        emphasis="primary"
      />
      <Stat value={summary.inProgressCount} label="In progress" />
      <Stat value={summary.hiddenCount} label="Hidden" emphasis="muted" />
    </div>
  );
}
