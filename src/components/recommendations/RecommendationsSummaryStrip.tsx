import type { PortfolioRecommendationsSummary } from "@/lib/recommendations/types";

export function RecommendationsSummaryStrip({
  summary,
}: {
  summary: PortfolioRecommendationsSummary;
}) {
  return (
    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
      <span>
        <span className="font-semibold text-foreground tabular-nums">
          {summary.clientsWithRecommendations}
        </span>{" "}
        {summary.clientsWithRecommendations === 1 ? "client" : "clients"} with matches
      </span>
      <span aria-hidden>·</span>
      <span>
        <span className="font-semibold text-foreground tabular-nums">
          {summary.totalRecommendations}
        </span>{" "}
        services
      </span>
      <span aria-hidden>·</span>
      <span>
        <span className="font-semibold text-foreground tabular-nums">{summary.pendingCount}</span>{" "}
        pending
      </span>
      <span aria-hidden>·</span>
      <span>
        <span className="font-semibold text-primary tabular-nums">
          {summary.actionNeededCount}
        </span>{" "}
        need outreach
      </span>
    </div>
  );
}
