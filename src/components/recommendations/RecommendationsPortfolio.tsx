import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight, FileEdit, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ClientRecommendationGroup } from "@/lib/recommendations/types";

function statusBadgeVariant(
  status: string
): "default" | "secondary" | "outline" | "success" | "warning" {
  switch (status) {
    case "PENDING":
      return "warning";
    case "ACCEPTED":
    case "COMPLETED":
      return "success";
    case "DECLINED":
      return "outline";
    default:
      return "secondary";
  }
}

function phaseLabel(phase: string): string {
  switch (phase) {
    case "PREVIEW":
      return "Preview";
    case "PROFILE":
      return "Risk profile";
    case "PORTFOLIO":
      return "Portfolio";
    default:
      return phase;
  }
}

function tierLabel(tier: string | null): string | null {
  if (!tier) return null;
  return tier === "ENHANCED" ? "Enhanced" : "Baseline";
}

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type EngagementData = {
  completedCount: number;
  totalCount: number;
  blockedCount: number;
};

type RecommendationsPortfolioProps = {
  groups: ClientRecommendationGroup[];
  engagementData?: Map<string, EngagementData>;
  trackingEnabled?: boolean;
};

function EngagementIndicator({ data }: { data?: EngagementData }) {
  if (!data) {
    return (
      <>
        <span aria-hidden>&middot;</span>
        <span className="text-muted-foreground">Engagement: --</span>
      </>
    );
  }

  return (
    <>
      <span aria-hidden>&middot;</span>
      <span className="tabular-nums">
        Engagement: {data.completedCount}/{data.totalCount}
      </span>
      {data.blockedCount > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="inline-block h-1.5 w-1.5 rounded-full bg-destructive"
                aria-label={`${data.blockedCount} blocked milestone${data.blockedCount === 1 ? "" : "s"}`}
              />
            </TooltipTrigger>
            <TooltipContent>
              {data.blockedCount} blocked milestone{data.blockedCount === 1 ? "" : "s"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </>
  );
}

export function RecommendationsPortfolio({
  groups,
  engagementData,
  trackingEnabled,
}: RecommendationsPortfolioProps) {
  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-12 text-center">
        <p className="text-sm font-medium text-foreground">No matched recommendations yet</p>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
          When clients complete assessments, the recommendation engine matches services from the
          platform catalog. Edit and publish them from each client&apos;s report workflow.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <Card key={group.clientId} className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg">{group.clientName}</CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-2">
                  <span>{group.recommendations.length} matched services</span>
                  {group.completedAt ? (
                    <>
                      <span aria-hidden>·</span>
                      <span>
                        Assessed {format(new Date(group.completedAt), "MMM d, yyyy")}
                      </span>
                    </>
                  ) : null}
                  <Badge variant="outline" className="h-5 text-[10px]">
                    {phaseLabel(group.deliverablePhase)}
                  </Badge>
                  {group.hasPublishedReport ? (
                    <Badge variant="success" className="h-5 text-[10px]">
                      Report published
                    </Badge>
                  ) : group.hasDraftReport ? (
                    <Badge variant="secondary" className="h-5 text-[10px]">
                      Draft in progress
                    </Badge>
                  ) : null}
                  {trackingEnabled && (
                    <EngagementIndicator
                      data={engagementData?.get(group.clientId)}
                    />
                  )}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href={group.intelligenceHref}
                    className="inline-flex items-center gap-1.5"
                  >
                    <Shield className="h-3.5 w-3.5" />
                    Intelligence
                  </Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href={group.editReportHref} className="inline-flex items-center gap-1.5">
                    <FileEdit className="h-3.5 w-3.5" />
                    Edit report
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
              {group.recommendations.map((rec) => (
                <li
                  key={rec.id}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground leading-snug">{rec.serviceName}</p>
                      <Badge variant={statusBadgeVariant(rec.status)} className="h-5 text-[10px]">
                        {rec.status.toLowerCase()}
                      </Badge>
                      {tierLabel(rec.tier) ? (
                        <Badge variant="outline" className="h-5 text-[10px]">
                          {tierLabel(rec.tier)}
                        </Badge>
                      ) : null}
                      <span className="text-xs text-muted-foreground tabular-nums">
                        Priority {rec.priority}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{rec.category}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                      {rec.description}
                    </p>
                    <p className="text-xs text-muted-foreground/90 italic">{rec.triggerSummary}</p>
                    {rec.advisorNotes?.trim() ? (
                      <p className="text-xs text-foreground/80 border-l-2 border-primary/30 pl-2">
                        {rec.advisorNotes.trim()}
                      </p>
                    ) : null}
                  </div>
                  <Button variant="ghost" size="sm" asChild className="shrink-0 self-start">
                    <Link
                      href={group.editReportHref}
                      className="inline-flex items-center gap-1 text-xs"
                    >
                      Annotate
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
