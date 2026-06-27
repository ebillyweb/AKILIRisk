import type { GuidancePackageSummary } from "@/lib/recommendations/types";

export function GuidanceSummaryStrip({
  summary,
}: {
  summary: GuidancePackageSummary;
}) {
  return (
    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
      <span>
        <span className="font-semibold text-foreground tabular-nums">
          {summary.totalItems}
        </span>{" "}
        total
      </span>
      <span aria-hidden>·</span>
      <span>
        <span className="font-semibold text-primary tabular-nums">
          {summary.includedCount}
        </span>{" "}
        included
      </span>
      <span aria-hidden>·</span>
      <span>
        <span className="font-semibold text-foreground tabular-nums">
          {summary.deferredCount}
        </span>{" "}
        deferred
      </span>
      <span aria-hidden>·</span>
      <span>
        <span className="font-semibold text-primary tabular-nums">
          {summary.completedCount}
        </span>{" "}
        completed
      </span>
      <span aria-hidden>·</span>
      <span>
        <span className="font-semibold text-foreground tabular-nums">
          {summary.inProgressCount}
        </span>{" "}
        in progress
      </span>
      <span aria-hidden>·</span>
      <span>
        <span className="font-semibold text-muted-foreground tabular-nums">
          {summary.hiddenCount}
        </span>{" "}
        hidden
      </span>
    </div>
  );
}
