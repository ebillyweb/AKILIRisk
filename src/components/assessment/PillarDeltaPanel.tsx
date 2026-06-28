"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { PillarDelta } from "@/lib/assessment/reassessment-types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PillarDeltaPanelProps {
  deltas: PillarDelta[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

// ---------------------------------------------------------------------------
// Pillar label mapping
// ---------------------------------------------------------------------------

const PILLAR_LABELS: Record<string, string> = {
  governance: "Governance",
  "cyber-digital": "Cyber & Digital",
  identity: "Identity",
  estate: "Estate",
  insurance: "Insurance",
  "physical-security": "Physical Security",
  tax: "Tax",
  liquidity: "Liquidity",
  behavioral: "Behavioral",
  "reputational-social": "Reputational & Social",
};

function pillarLabel(pillar: string): string {
  return PILLAR_LABELS[pillar] ?? pillar;
}

// ---------------------------------------------------------------------------
// Delta chip
// ---------------------------------------------------------------------------

function DeltaChip({ delta }: { delta: PillarDelta }) {
  if (delta.direction === "improved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full py-1 px-2 text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        <TrendingUp className="h-3 w-3" />
        +{delta.delta}
      </span>
    );
  }

  if (delta.direction === "regressed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full py-1 px-2 text-xs font-semibold bg-destructive/10 text-destructive">
        <TrendingDown className="h-3 w-3" />
        {delta.delta}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full py-1 px-2 text-xs font-semibold bg-muted text-muted-foreground">
      <Minus className="h-3 w-3" />
      No change
    </span>
  );
}

// ---------------------------------------------------------------------------
// Attribution section
// ---------------------------------------------------------------------------

function AttributionList({ delta }: { delta: PillarDelta }) {
  const [expanded, setExpanded] = useState(false);
  const isZeroState =
    delta.direction === "unchanged" &&
    delta.attribution.length === 1 &&
    delta.attribution[0] === "No new planning activity";

  if (isZeroState) {
    return null;
  }

  const prefix =
    delta.direction === "improved"
      ? "Why it improved:"
      : delta.direction === "regressed"
        ? "Why it regressed:"
        : "Why it's unchanged:";

  const visibleItems = expanded
    ? delta.attribution
    : delta.attribution.slice(0, 3);
  const hasMore = delta.attribution.length > 3;

  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-muted-foreground mb-1">
        {prefix}
      </p>
      <ul className="space-y-0.5">
        {visibleItems.map((item, i) => (
          <li
            key={i}
            className="text-xs text-muted-foreground flex items-start gap-1.5"
          >
            <span className="mt-0.5 shrink-0">&bull;</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      {hasMore && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="text-xs text-primary hover:underline mt-1"
        >
          Show more
        </button>
      )}
      {hasMore && expanded && (
        <button
          onClick={() => setExpanded(false)}
          className="text-xs text-primary hover:underline mt-1"
        >
          Show less
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pillar card
// ---------------------------------------------------------------------------

function PillarDeltaCard({ delta }: { delta: PillarDelta }) {
  const isZeroState =
    delta.direction === "unchanged" &&
    delta.attribution.length === 1 &&
    delta.attribution[0] === "No new planning activity";

  return (
    <Card className="border-border/80 bg-card/92">
      <CardContent className="pt-5">
        <p className="professional-kicker mb-2">
          {pillarLabel(delta.pillar)}
        </p>

        {isZeroState ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No change &mdash; No new planning activity
          </p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {delta.previousScore}
              </span>
              <span className="text-muted-foreground">&rarr;</span>
              <span className="text-xl font-semibold">
                {delta.currentScore}
              </span>
              <DeltaChip delta={delta} />
            </div>
            <AttributionList delta={delta} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="border-border/80 bg-card/92">
          <CardContent className="pt-5 space-y-3">
            <Skeleton className="h-3 w-24" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-8" />
              <Skeleton className="h-5 w-4" />
              <Skeleton className="h-6 w-10" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-3 w-32 mt-2" />
            <Skeleton className="h-3 w-48" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PillarDeltaPanel({
  deltas,
  loading,
  error,
  onRetry,
}: PillarDeltaPanelProps) {
  // Loading state
  if (loading) {
    return <LoadingSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="pt-5 text-center">
          <p className="text-sm text-destructive mb-3">
            Scores could not be loaded. Check your connection and try again.
          </p>
          {onRetry && (
            <Button variant="ghost" size="sm" onClick={onRetry}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (!deltas || deltas.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
        <h3 className="text-lg font-semibold mb-2">
          No previous assessment to compare
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Complete your first reassessment to see per-pillar improvement and
          track the impact of your planning work.
        </p>
      </div>
    );
  }

  // Populated state
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {deltas.map((delta) => (
        <PillarDeltaCard key={delta.pillar} delta={delta} />
      ))}
    </div>
  );
}
