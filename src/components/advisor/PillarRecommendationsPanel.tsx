"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PillarRecommendation } from "@/lib/intake/pillar-recommendations";
import { cn } from "@/lib/utils";

const STRENGTH_LABEL: Record<PillarRecommendation["strength"], string> = {
  strong: "Recommended",
  moderate: "Moderate fit",
  low: "Low signal",
};

const STRENGTH_VARIANT: Record<
  PillarRecommendation["strength"],
  "default" | "secondary" | "outline"
> = {
  strong: "default",
  moderate: "secondary",
  low: "outline",
};

type PillarRecommendationsPanelProps = {
  recommendations: PillarRecommendation[];
  onSelectRecommended?: () => void;
  onScrollToQuestion?: (questionId: string) => void;
};

export function PillarRecommendationsPanel({
  recommendations,
  onSelectRecommended,
  onScrollToQuestion,
}: PillarRecommendationsPanelProps) {
  const hasSignals = recommendations.some((r) => r.strength !== "low");
  const strongCount = recommendations.filter((r) => r.strength === "strong").length;

  return (
    <section className="space-y-4" aria-labelledby="pillar-recommendations-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3
            id="pillar-recommendations-heading"
            className="text-base font-semibold tracking-tight"
          >
            Recommended domains
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Based on intake answers and question tagging. Suggestions only — you
            confirm domains below.
          </p>
        </div>
        {strongCount > 0 && onSelectRecommended ? (
          <Button type="button" size="sm" variant="outline" onClick={onSelectRecommended}>
            Select suggested
          </Button>
        ) : null}
      </div>

      {!hasSignals ? (
        <p className="rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          No automated recommendations yet. Tag intake questions with related
          pillars in admin, or select domains manually.
        </p>
      ) : (
        <ul className="space-y-3" role="list">
          {recommendations
            .filter((r) => r.strength !== "low")
            .map((rec) => (
              <li
                key={rec.pillarId}
                className={cn(
                  "rounded-lg border bg-card px-4 py-3",
                  rec.strength === "strong" && "border-primary/30",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{rec.pillarName}</span>
                  <Badge variant={STRENGTH_VARIANT[rec.strength]}>
                    {STRENGTH_LABEL[rec.strength]}
                  </Badge>
                </div>
                {rec.suggestedAction ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Suggested action: </span>
                    {rec.suggestedAction}
                  </p>
                ) : null}
                {rec.reasons.length > 0 ? (
                  <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                    {rec.reasons.slice(0, 2).map((reason) => (
                      <li key={`${rec.pillarId}-${reason.questionId}`}>
                        {onScrollToQuestion ? (
                          <button
                            type="button"
                            className="text-left text-primary underline-offset-2 hover:underline"
                            onClick={() => onScrollToQuestion(reason.questionId)}
                          >
                            {reason.questionLabel.slice(0, 72)}
                            {reason.questionLabel.length > 72 ? "…" : ""}
                          </button>
                        ) : (
                          <span>{reason.questionLabel.slice(0, 72)}</span>
                        )}
                        <span className="block italic">&ldquo;{reason.excerpt}&rdquo;</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}
