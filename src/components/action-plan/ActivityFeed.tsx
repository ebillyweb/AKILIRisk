"use client";

import { useState } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ActivityFeedItem } from "@/lib/engagement/activity-feed";

type ActivityFeedProps = {
  activities: ActivityFeedItem[];
  onLoadMore?: () => void;
  hasMore?: boolean;
};

function formatDateGroup(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMM d, yyyy");
}

function formatAction(item: ActivityFeedItem): string {
  switch (item.action) {
    case "action_plan_published":
      return `Action plan published for ${item.recommendationName}`;
    case "auto_completed":
      return `${item.recommendationName} automatically marked as completed`;
    case "validation_requested":
      return `Validation requested for ${item.recommendationName}`;
    case "milestone_blocked":
      return `Milestone blocked on ${item.recommendationName}`;
    case "milestone_deferred":
      return `Milestone deferred on ${item.recommendationName}`;
    default:
      if (item.action.startsWith("milestone_"))
        return `Milestone updated on ${item.recommendationName}`;
      if (item.action.startsWith("status_"))
        return `${item.recommendationName} status updated`;
      return `Activity on ${item.recommendationName}`;
  }
}

function groupByDate(activities: ActivityFeedItem[]): Map<string, ActivityFeedItem[]> {
  const groups = new Map<string, ActivityFeedItem[]>();
  for (const activity of activities) {
    const key = formatDateGroup(activity.createdAt);
    const group = groups.get(key) ?? [];
    group.push(activity);
    groups.set(key, group);
  }
  return groups;
}

export function ActivityFeed({ activities, onLoadMore, hasMore }: ActivityFeedProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (activities.length === 0) return null;

  const dateGroups = groupByDate(activities);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 text-sm font-semibold text-foreground hover:text-foreground/80">
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`}
        />
        Recent Activity ({activities.length})
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-3" role="feed" aria-label="Recent activity">
          {Array.from(dateGroups.entries()).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              <div className="sticky top-0 z-10 bg-muted/50 px-2 py-1">
                <span className="text-xs font-semibold text-muted-foreground">
                  {dateLabel}
                </span>
              </div>

              {items.map((item) => (
                <div
                  key={item.id}
                  role="article"
                  className="flex gap-3 px-2 py-2"
                >
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center pt-1.5">
                    <div className="h-2 w-2 rounded-full bg-brand/60" />
                    <div className="mt-1 w-0.5 flex-1 bg-border" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      {formatAction(item)}
                    </p>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground truncate">
                        {item.recommendationName}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {format(item.createdAt, "h:mm a")}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {hasMore && (
            <div className="mt-2 text-center">
              <Button variant="ghost" size="sm" onClick={onLoadMore}>
                Show more activity
              </Button>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
