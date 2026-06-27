"use client";

import { useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProfileInsightsSection } from "@/components/guidance/ProfileInsightsSection";
import { AttentionItemsSection } from "@/components/guidance/AttentionItemsSection";
import { GuidanceSummaryStrip } from "@/components/guidance/GuidanceSummaryStrip";
import { BulkActionBar } from "@/components/guidance/BulkActionBar";
import type { GuidancePackage, GuidancePackageItem } from "@/lib/recommendations/types";

// Lazy import for RecommendationCard to avoid circular issues
import { RecommendationCard } from "@/components/guidance/RecommendationCard";

type Props = {
  guidancePackage: GuidancePackage;
};

function statusBadgeVariant(
  status: string
): "default" | "secondary" | "outline" | "success" | "warning" {
  switch (status) {
    case "INCLUDED":
      return "success";
    case "IN_PROGRESS":
      return "warning";
    case "COMPLETED":
      return "success";
    case "DEFERRED":
      return "warning";
    case "REVIEWED":
      return "outline";
    case "GENERATED":
    default:
      return "secondary";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "INCLUDED":
      return "In Action Plan";
    case "IN_PROGRESS":
      return "In Progress";
    case "COMPLETED":
      return "Completed";
    case "DEFERRED":
      return "Deferred";
    case "REVIEWED":
      return "Reviewed";
    case "GENERATED":
      return "Generated";
    default:
      return status;
  }
}

function priorityLabel(item: GuidancePackageItem): string {
  if (item.advisorPriority) return item.advisorPriority;
  if (item.priority <= 2) return "HIGH";
  if (item.priority <= 4) return "MEDIUM";
  return "LOW";
}

export function GuidanceReviewPage({ guidancePackage }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("summary");

  const handleSelect = useCallback((id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleNavigateToItem = useCallback((itemId: string) => {
    setActiveTab("actions");
    // Scroll to the specific card after tab switch
    setTimeout(() => {
      const el = document.getElementById(`rec-card-${itemId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, []);

  const { items, summary } = guidancePackage;

  // Filter items for each tab
  const activeItems = items.filter(
    (item) => item.status !== "DEFERRED" && !item.hiddenFromClient
  );
  const deferredItems = items.filter((item) => item.status === "DEFERRED");
  const implementationItems = items.filter((item) =>
    ["INCLUDED", "IN_PROGRESS", "COMPLETED"].includes(item.status)
  );

  // Group implementation items by time horizon
  const implementationByHorizon = new Map<string, GuidancePackageItem[]>();
  for (const item of implementationItems) {
    const horizon = item.timeHorizon || "Unassigned";
    const existing = implementationByHorizon.get(horizon) ?? [];
    existing.push(item);
    implementationByHorizon.set(horizon, existing);
  }

  // Top priorities for executive summary
  const topPriorities = [...items]
    .filter((item) => !item.hiddenFromClient && item.status !== "DEFERRED")
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 5);

  return (
    <div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full flex-wrap">
          <TabsTrigger value="summary">Executive Summary</TabsTrigger>
          <TabsTrigger value="insights">Profile Insights</TabsTrigger>
          <TabsTrigger value="attention">Attention Items</TabsTrigger>
          <TabsTrigger value="actions">Recommended Actions</TabsTrigger>
          <TabsTrigger value="deferred">
            Future Considerations
            {deferredItems.length > 0 && (
              <Badge variant="warning" className="ml-1.5 h-5 text-[10px]">
                {deferredItems.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="implementation">Implementation Plan</TabsTrigger>
        </TabsList>

        {/* Executive Summary */}
        <TabsContent value="summary" className="mt-6 space-y-6">
          <GuidanceSummaryStrip summary={summary} />
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold">
                Top Priorities
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {topPriorities.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No active priorities identified yet.
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {topPriorities.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start justify-between gap-2 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-medium text-foreground">
                          {item.serviceName}
                        </p>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {item.description}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge
                          variant={statusBadgeVariant(item.status)}
                          className="h-5 text-[10px]"
                        >
                          {statusLabel(item.status)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {priorityLabel(item)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profile Insights */}
        <TabsContent value="insights" className="mt-6">
          <ProfileInsightsSection items={items} />
        </TabsContent>

        {/* Attention Items */}
        <TabsContent value="attention" className="mt-6">
          <AttentionItemsSection
            items={items}
            onNavigateToItem={handleNavigateToItem}
          />
        </TabsContent>

        {/* Recommended Actions */}
        <TabsContent value="actions" className="mt-6">
          {activeItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-12 text-center">
              <p className="text-sm font-medium text-foreground">
                No active recommendations
              </p>
              <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                All recommendations have been deferred or hidden.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeItems.map((item) => (
                <RecommendationCard
                  key={item.id}
                  item={item}
                  selected={selectedIds.has(item.id)}
                  onSelect={handleSelect}
                  clientName={guidancePackage.clientName}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Deferred / Future Considerations */}
        <TabsContent value="deferred" className="mt-6">
          {deferredItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-12 text-center">
              <p className="text-sm font-medium text-foreground">
                No deferred recommendations
              </p>
              <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                Deferred recommendations will appear here as future
                considerations.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {deferredItems.map((item) => (
                <RecommendationCard
                  key={item.id}
                  item={item}
                  selected={selectedIds.has(item.id)}
                  onSelect={handleSelect}
                  clientName={guidancePackage.clientName}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Implementation Plan */}
        <TabsContent value="implementation" className="mt-6">
          {implementationItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-12 text-center">
              <p className="text-sm font-medium text-foreground">
                No items in the implementation plan yet
              </p>
              <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                Include recommendations in the action plan to build the
                implementation roadmap.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {[...implementationByHorizon.entries()].map(
                ([horizon, horizonItems]) => (
                  <Card
                    key={horizon}
                    className="border-border/70 shadow-sm"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg font-semibold">
                          {horizon}
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className="h-5 text-[10px]"
                        >
                          {horizonItems.length}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <ul className="divide-y divide-border/60">
                        {horizonItems.map((item) => (
                          <li
                            key={item.id}
                            className="flex items-start justify-between gap-2 py-3 first:pt-0 last:pb-0"
                          >
                            <div className="min-w-0 space-y-1">
                              <p className="text-sm font-medium text-foreground">
                                {item.serviceName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {item.category}
                              </p>
                            </div>
                            <Badge
                              variant={statusBadgeVariant(item.status)}
                              className="shrink-0 h-5 text-[10px]"
                            >
                              {statusLabel(item.status)}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selectedIds.size > 0 && (
        <BulkActionBar
          selectedIds={[...selectedIds]}
          onClearSelection={handleClearSelection}
          clientId={guidancePackage.clientId}
        />
      )}
    </div>
  );
}
