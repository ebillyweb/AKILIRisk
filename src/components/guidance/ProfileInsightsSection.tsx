"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GuidancePackageItem } from "@/lib/recommendations/types";

type Props = {
  items: GuidancePackageItem[];
};

type CategoryInsight = {
  category: string;
  items: GuidancePackageItem[];
  assessmentCount: number;
  crossCutting: boolean;
};

/**
 * Synthesize cross-assessment insights grouped by category (D-03 Profile Insights).
 * Shows patterns across all completed assessments for the client.
 */
function synthesizeInsights(items: GuidancePackageItem[]): CategoryInsight[] {
  const byCategory = new Map<string, GuidancePackageItem[]>();

  for (const item of items) {
    const cat = item.category || "General";
    const existing = byCategory.get(cat) ?? [];
    existing.push(item);
    byCategory.set(cat, existing);
  }

  return [...byCategory.entries()]
    .map(([category, categoryItems]) => {
      // Count unique assessment sources across all items in this category
      const allSources = new Set<string>();
      for (const item of categoryItems) {
        for (const src of item.assessmentSources) {
          allSources.add(src);
        }
      }

      return {
        category,
        items: categoryItems,
        assessmentCount: allSources.size,
        crossCutting: allSources.size > 1,
      };
    })
    .sort((a, b) => {
      // Cross-cutting patterns first, then by item count
      if (a.crossCutting !== b.crossCutting) return a.crossCutting ? -1 : 1;
      return b.items.length - a.items.length;
    });
}

export function ProfileInsightsSection({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-12 text-center">
        <p className="text-sm font-medium text-foreground">
          Complete additional assessments to see cross-assessment insights.
        </p>
      </div>
    );
  }

  const insights = synthesizeInsights(items);

  return (
    <div className="space-y-4">
      {insights.map((insight) => (
        <Card key={insight.category} className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-semibold">
                {insight.category}
              </CardTitle>
              <Badge variant="outline" className="h-5 text-[10px]">
                {insight.items.length}{" "}
                {insight.items.length === 1
                  ? "recommendation"
                  : "recommendations"}
              </Badge>
              {insight.crossCutting && (
                <Badge variant="secondary" className="h-5 text-[10px]">
                  Cross-assessment
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {insight.items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-border/60 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {item.serviceName}
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {item.triggerSummary}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {item.assessmentSources.length > 1 && (
                        <Badge variant="outline" className="h-5 text-[10px]">
                          {item.assessmentSources.length} assessments
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
