"use client";

import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  FileText,
  TrendingUp,
  TrendingDown,
  Calendar,
  CheckCircle2,
  Activity,
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActivityFeedItem } from "@/lib/engagement/activity-feed";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface IntelligenceTimelineProps {
  items: ActivityFeedItem[];
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Tab categories and action mapping
// ---------------------------------------------------------------------------

type TabKey = "all" | "assessments" | "score_changes" | "cadence" | "recommendation_impact";

const TABS: { key: TabKey; label: string; emptyLabel: string }[] = [
  { key: "all", label: "All", emptyLabel: "" },
  { key: "assessments", label: "Assessments", emptyLabel: "Assessment" },
  { key: "score_changes", label: "Score Changes", emptyLabel: "Score" },
  { key: "cadence", label: "Cadence", emptyLabel: "Cadence" },
  { key: "recommendation_impact", label: "Recommendation Impact", emptyLabel: "Recommendation" },
];

const TAB_ACTIONS: Record<Exclude<TabKey, "all">, string[]> = {
  assessments: [
    "assessment_started",
    "assessment_completed",
    "score_calculated",
    "reassessment_triggered",
  ],
  score_changes: ["pillar_score_delta", "risk_level_transition"],
  cadence: [
    "cadence_due_approaching",
    "cadence_overdue",
    "cadence_changed",
    "cadence_system_recommended",
  ],
  recommendation_impact: [
    "recommendation_impact_measured",
    "completion_milestone_reached",
  ],
};

// ---------------------------------------------------------------------------
// Icon mapping
// ---------------------------------------------------------------------------

function EventIcon({ action, detail }: { action: string; detail: unknown }) {
  // Assessment events
  if (
    [
      "assessment_started",
      "assessment_completed",
      "score_calculated",
      "reassessment_triggered",
    ].includes(action)
  ) {
    return <FileText className="h-4 w-4 text-muted-foreground shrink-0" />;
  }

  // Score change events
  if (action === "pillar_score_delta" || action === "risk_level_transition") {
    const d = detail as Record<string, unknown> | null;
    const delta = typeof d?.delta === "number" ? d.delta : 0;
    return delta >= 0 ? (
      <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
    ) : (
      <TrendingDown className="h-4 w-4 text-destructive shrink-0" />
    );
  }

  // Cadence events
  if (
    [
      "cadence_due_approaching",
      "cadence_overdue",
      "cadence_changed",
      "cadence_system_recommended",
    ].includes(action)
  ) {
    return <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />;
  }

  // Recommendation impact events
  if (
    ["recommendation_impact_measured", "completion_milestone_reached"].includes(
      action,
    )
  ) {
    return <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />;
  }

  // Default: recommendation lifecycle events
  return <Activity className="h-4 w-4 text-muted-foreground shrink-0" />;
}

// ---------------------------------------------------------------------------
// Summary text derivation
// ---------------------------------------------------------------------------

function eventSummary(item: ActivityFeedItem): string {
  const d = item.detail as Record<string, unknown> | null;

  switch (item.action) {
    case "assessment_started":
      return "Assessment started";
    case "assessment_completed":
      return "Assessment completed";
    case "score_calculated":
      return "Overall score calculated";
    case "reassessment_triggered":
      return `Reassessment started${d?.type ? ` (${d.type})` : ""}`;

    case "pillar_score_delta": {
      const pillar = typeof d?.pillar === "string" ? d.pillar : "Pillar";
      const delta = typeof d?.delta === "number" ? d.delta : 0;
      const sign = delta >= 0 ? "+" : "";
      return `${pillar} score ${delta >= 0 ? "improved" : "regressed"} ${sign}${delta}`;
    }
    case "risk_level_transition": {
      const from = typeof d?.from === "string" ? d.from : "?";
      const to = typeof d?.to === "string" ? d.to : "?";
      return `Risk level changed: ${from} to ${to}`;
    }

    case "cadence_due_approaching": {
      const days = typeof d?.daysUntilDue === "number" ? d.daysUntilDue : "?";
      return `Reassessment due in ${days} days`;
    }
    case "cadence_overdue": {
      const days = typeof d?.daysOverdue === "number" ? d.daysOverdue : "?";
      return `Reassessment overdue by ${days} days`;
    }
    case "cadence_changed":
      return `Review cadence updated${d?.frequency ? ` to ${d.frequency}` : ""}`;
    case "cadence_system_recommended":
      return d?.reason
        ? String(d.reason)
        : "System recommends reassessment";

    case "recommendation_impact_measured":
      return "Recommendation impact measured";
    case "completion_milestone_reached":
      return "Completion milestone reached";

    default:
      // Recommendation lifecycle events: use recommendationName
      return item.recommendationName ?? item.action;
  }
}

// ---------------------------------------------------------------------------
// Event row
// ---------------------------------------------------------------------------

function EventRow({ item }: { item: ActivityFeedItem }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5">
        <EventIcon action={item.action} detail={item.detail} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{eventSummary(item)}</p>
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function TimelineSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function IntelligenceTimeline({
  items,
  loading,
}: IntelligenceTimelineProps) {
  const filtered = useMemo(() => {
    const result: Record<TabKey, ActivityFeedItem[]> = {
      all: items,
      assessments: [],
      score_changes: [],
      cadence: [],
      recommendation_impact: [],
    };

    for (const item of items) {
      for (const [tab, actions] of Object.entries(TAB_ACTIONS)) {
        if (actions.includes(item.action)) {
          result[tab as Exclude<TabKey, "all">].push(item);
        }
      }
    }

    return result;
  }, [items]);

  if (loading) {
    return <TimelineSkeleton />;
  }

  return (
    <Tabs defaultValue="all" className="w-full">
      <TabsList className="w-full justify-start overflow-x-auto">
        {TABS.map((tab) => (
          <TabsTrigger key={tab.key} value={tab.key} className="text-xs">
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {TABS.map((tab) => (
        <TabsContent key={tab.key} value={tab.key}>
          {filtered[tab.key].length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {tab.key === "all"
                ? "No events yet."
                : `No ${tab.emptyLabel} events yet.`}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {filtered[tab.key].map((item) => (
                <EventRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
