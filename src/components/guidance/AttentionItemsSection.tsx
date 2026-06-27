"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GuidancePackageItem } from "@/lib/recommendations/types";

type Props = {
  items: GuidancePackageItem[];
  onNavigateToItem?: (itemId: string) => void;
};

type AttentionDomain = {
  label: string;
  keywords: string[];
};

const ATTENTION_DOMAINS: AttentionDomain[] = [
  {
    label: "Family Dynamics",
    keywords: ["family", "household", "dependent", "member"],
  },
  {
    label: "Ownership & Control",
    keywords: ["ownership", "control", "asset", "property", "business"],
  },
  {
    label: "Governance",
    keywords: ["governance", "compliance", "policy", "board", "fiduciary"],
  },
  {
    label: "Succession Planning",
    keywords: [
      "succession",
      "estate",
      "trust",
      "inheritance",
      "business_continuity",
      "continuity",
    ],
  },
];

function matchesDomain(item: GuidancePackageItem, domain: AttentionDomain): boolean {
  const searchText = `${item.category} ${item.serviceName} ${item.description}`.toLowerCase();
  return domain.keywords.some((kw) => searchText.includes(kw));
}

function priorityLabel(item: GuidancePackageItem): { label: string; variant: "destructive" | "warning" | "outline" } {
  const priority = item.advisorPriority ?? (item.priority <= 2 ? "HIGH" : item.priority <= 4 ? "MEDIUM" : "LOW");
  switch (priority) {
    case "HIGH":
      return { label: "High", variant: "destructive" };
    case "MEDIUM":
      return { label: "Medium", variant: "warning" };
    default:
      return { label: "Low", variant: "outline" };
  }
}

export function AttentionItemsSection({ items, onNavigateToItem }: Props) {
  const domainGroups = ATTENTION_DOMAINS.map((domain) => {
    const matched = items.filter((item) => matchesDomain(item, domain));
    return { ...domain, items: matched };
  }).filter((group) => group.items.length > 0);

  if (domainGroups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-12 text-center">
        <p className="text-sm font-medium text-foreground">
          No attention items identified.
        </p>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
          This client&apos;s assessments did not flag family, ownership,
          governance, or succession concerns.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {domainGroups.map((group) => (
        <Card key={group.label} className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-semibold">
                {group.label}
              </CardTitle>
              <Badge variant="outline" className="h-5 text-[10px]">
                {group.items.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="divide-y divide-border/60">
              {group.items.map((item) => {
                const prio = priorityLabel(item);
                return (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-2 py-3 first:pt-0 last:pb-0"
                  >
                    <button
                      type="button"
                      className="min-w-0 text-left hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded"
                      onClick={() => onNavigateToItem?.(item.id)}
                    >
                      <p className="text-sm font-medium text-foreground">
                        {item.serviceName}
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {item.description}
                      </p>
                    </button>
                    <Badge
                      variant={prio.variant === "destructive" ? "outline" : prio.variant}
                      className={`shrink-0 h-5 text-[10px] ${
                        prio.variant === "destructive"
                          ? "bg-destructive/10 text-destructive border-destructive/20"
                          : ""
                      }`}
                    >
                      {prio.label}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
