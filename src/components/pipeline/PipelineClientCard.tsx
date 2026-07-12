"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Clock, MoreHorizontal } from "lucide-react";

import { PipelineChevronTrack } from "./PipelineChevronTrack";
import { PipelineProcessStateLabel } from "./PipelineProcessStateLabel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { STALE_SCORES_COPY } from "@/lib/advisor/assessment-lifecycle-copy";
import {
  formatPipelineClientRowTitle,
  resolveAdvisorClientPipelineLabels,
} from "@/lib/pipeline/client-display";
import type { PipelineClient } from "@/lib/pipeline/types";
import { cn } from "@/lib/utils";

function pipelineClientInitials(client: PipelineClient): string {
  const { headline } = resolveAdvisorClientPipelineLabels(client);
  const referenceMatch = headline.match(/\bCL-[A-Z0-9]+/i);
  if (referenceMatch) {
    return referenceMatch[0]!.replace("CL-", "").slice(0, 2).toUpperCase();
  }
  const words = headline.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]![0] ?? ""}${words[1]![0] ?? ""}`.toUpperCase();
  }
  return headline.slice(0, 2).toUpperCase() || "CL";
}

interface PipelineClientCardProps {
  client: PipelineClient;
  showDocumentsColumn?: boolean;
  monitoringEnabled?: boolean;
}

export function PipelineClientCard({
  client,
  showDocumentsColumn = true,
  monitoringEnabled = false,
}: PipelineClientCardProps) {
  const { headline, secondary } = resolveAdvisorClientPipelineLabels(client);
  const lastActivityLabel = formatDistanceToNow(client.lastActivity, {
    addSuffix: true,
  });
  const isComplete = client.progress >= 100;
  const reviewHref =
    client.awaitingIntakeReview && client.intakeReviewInterviewId
      ? `/advisor/review/${client.intakeReviewInterviewId}`
      : null;

  return (
    <article
      className={cn(
        "rounded-xl border border-border/70 bg-card p-4 shadow-sm transition-colors",
        "hover:border-border hover:bg-muted/15",
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        {/* Client */}
        <div className="flex min-w-0 flex-1 items-start gap-3 lg:max-w-[280px]">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground"
            aria-hidden
          >
            {pipelineClientInitials(client)}
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <Link
              href={`/advisor/pipeline/${client.id}`}
              className="block truncate font-semibold text-foreground hover:text-primary hover:underline"
              title={formatPipelineClientRowTitle(client)}
            >
              {headline}
            </Link>
            {secondary ? (
              <p className="truncate text-sm text-muted-foreground">{secondary}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-1.5">
              <PipelineProcessStateLabel
                stage={client.stage}
                documentRequirementsEnabled={showDocumentsColumn}
                stalled={client.stalled}
                show="state"
              />
              {client.staleScores ? (
                <Badge variant="warning" className="text-[0.65rem]">
                  {STALE_SCORES_COPY.tableBadge}
                </Badge>
              ) : null}
            </div>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3.5 shrink-0" aria-hidden />
              <span>{lastActivityLabel}</span>
            </p>
          </div>
        </div>

        {/* Chevron pipeline */}
        <div className="min-w-0 flex-[1.4]">
          <PipelineChevronTrack
            currentStage={client.stage}
            showDocumentsStage={showDocumentsColumn}
            monitoringEnabled={monitoringEnabled}
          />
        </div>

        {/* Progress */}
        <div className="flex min-w-[7.5rem] flex-col gap-1.5 lg:shrink-0">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Progress
          </span>
          <Progress
            value={client.progress}
            className="h-1.5"
            indicatorClassName={cn(
              isComplete ? "bg-emerald-500" : "bg-sky-500",
            )}
            aria-label={`Workflow progress ${client.progress}%`}
          />
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {client.progress}%
          </span>
          {showDocumentsColumn && client.documents.required > 0 ? (
            <span className="text-xs tabular-nums text-muted-foreground">
              Docs {client.documents.fulfilled}/{client.documents.required}
            </span>
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center self-start lg:self-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                aria-label={`Actions for ${headline}`}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/advisor/pipeline/${client.id}`}>View client</Link>
              </DropdownMenuItem>
              {reviewHref ? (
                <DropdownMenuItem asChild>
                  <Link href={reviewHref}>Review intake</Link>
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </article>
  );
}
