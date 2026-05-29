import type { SignalFeedSummary } from "@/lib/signals/types";

export function SignalSummaryStrip({ summary }: { summary: SignalFeedSummary }) {
  return (
    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
      <span>
        <span className="font-semibold text-foreground tabular-nums">{summary.unreadCount}</span>{" "}
        unread
      </span>
      <span aria-hidden>·</span>
      <span>
        <span className="font-semibold text-destructive tabular-nums">{summary.criticalCount}</span>{" "}
        critical
      </span>
      <span aria-hidden>·</span>
      <span>
        <span className="font-semibold text-foreground tabular-nums">{summary.moderateCount}</span>{" "}
        moderate
      </span>
      <span aria-hidden>·</span>
      <span>
        <span className="font-semibold text-foreground tabular-nums">{summary.riskCount}</span> risk ·{" "}
        <span className="font-semibold text-foreground tabular-nums">{summary.workflowCount}</span>{" "}
        workflow
      </span>
    </div>
  );
}
