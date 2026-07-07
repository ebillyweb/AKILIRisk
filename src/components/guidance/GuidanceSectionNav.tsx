"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CalendarRange,
  Clock3,
  LayoutDashboard,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type GuidanceTabId =
  | "summary"
  | "insights"
  | "attention"
  | "actions"
  | "deferred"
  | "implementation";

type GuidanceSection = {
  id: GuidanceTabId;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
};

export const GUIDANCE_SECTIONS: GuidanceSection[] = [
  {
    id: "summary",
    label: "Executive Summary",
    shortLabel: "Summary",
    description: "Top priorities and package overview",
    icon: LayoutDashboard,
  },
  {
    id: "insights",
    label: "Profile Insights",
    shortLabel: "Insights",
    description: "Assessment-driven client context",
    icon: Sparkles,
  },
  {
    id: "attention",
    label: "Attention Items",
    shortLabel: "Attention",
    description: "Family, governance, and succession flags",
    icon: AlertTriangle,
  },
  {
    id: "actions",
    label: "Recommended Actions",
    shortLabel: "Actions",
    description: "Review, include, defer, or hide items",
    icon: ListChecks,
  },
  {
    id: "deferred",
    label: "Future Considerations",
    shortLabel: "Future",
    description: "Deferred recommendations for later",
    icon: Clock3,
  },
  {
    id: "implementation",
    label: "Implementation Plan",
    shortLabel: "Plan",
    description: "Action plan grouped by time horizon",
    icon: CalendarRange,
  },
];

type Props = {
  deferredCount?: number;
};

export function GuidanceSectionNav({ deferredCount = 0 }: Props) {
  return (
    <TabsList
      aria-label="Guidance sections"
      variant="line"
      className={cn(
        // Override tabs.tsx h-9 constraint from horizontal orientation
        "!h-auto w-full shrink-0 rounded-none bg-muted/30 p-2 text-muted-foreground",
        "grid grid-cols-3 gap-1 border-b border-border/60",
        "lg:flex lg:flex-col lg:items-stretch lg:gap-0.5 lg:self-stretch lg:border-b-0 lg:border-r lg:bg-muted/20 lg:px-2 lg:py-3"
      )}
    >
      {GUIDANCE_SECTIONS.map((section) => {
        const Icon = section.icon;
        const showDeferredBadge =
          section.id === "deferred" && deferredCount > 0;

        return (
          <TabsTrigger
            key={section.id}
            value={section.id}
            className={cn(
              // Override tabs.tsx flex-1 / fixed height defaults
              "!h-auto !flex-none min-h-10 w-full rounded-md px-2.5 py-2 text-left text-xs font-medium whitespace-normal transition-colors sm:text-sm",
              "inline-flex items-center gap-2 lg:justify-start lg:px-3 lg:py-2.5",
              "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
              "lg:data-[state=active]:border-primary/40 lg:data-[state=active]:border-l-2 lg:data-[state=active]:pl-[calc(0.75rem-2px)]",
              "after:hidden"
            )}
          >
            <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
            <span className="min-w-0 flex-1 leading-snug">
              <span className="lg:hidden">{section.shortLabel}</span>
              <span className="hidden lg:inline">{section.label}</span>
            </span>
            {showDeferredBadge ? (
              <Badge
                variant="warning"
                className="h-5 min-w-5 shrink-0 px-1 text-[10px] tabular-nums"
              >
                {deferredCount}
              </Badge>
            ) : null}
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}

export function GuidanceSectionHeader({
  activeTab,
}: {
  activeTab: GuidanceTabId;
}) {
  const section = GUIDANCE_SECTIONS.find((item) => item.id === activeTab);
  if (!section) return null;

  const Icon = section.icon;

  return (
    <header className="mb-5 border-b border-border/50 pb-4">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <h2 className="text-lg font-semibold text-foreground">
            {section.label}
          </h2>
          <p className="text-sm text-muted-foreground">{section.description}</p>
        </div>
      </div>
    </header>
  );
}
