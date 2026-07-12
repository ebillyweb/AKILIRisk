"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useDebouncedCallback } from "use-debounce";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PIPELINE_SEARCH_COPY } from "@/lib/advisor/pii-policy";
import { getAdvisorPipelineStageLabel } from "@/lib/pipeline/status";
import { PipelineProcessStateLabel } from "@/components/pipeline/PipelineProcessStateLabel";
import type { PipelineFilters, PipelineMetrics } from "@/lib/pipeline/types";
import type { ClientWorkflowStage } from "@prisma/client";

interface PipelineFiltersProps {
  filters: PipelineFilters;
  onFilterChange: (filters: PipelineFilters) => void;
  metrics: PipelineMetrics;
  totalCount: number;
  filteredCount: number;
  page?: number;
  pageSize?: number;
  pseudonymousWorkspaceLabeling?: boolean;
  documentRequirementsEnabled?: boolean;
}

const stages: ClientWorkflowStage[] = [
  "INVITED",
  "REGISTERED",
  "INTAKE_IN_PROGRESS",
  "INTAKE_COMPLETE",
  "ASSESSMENT_IN_PROGRESS",
  "ASSESSMENT_COMPLETE",
  "DOCUMENTS_REQUIRED",
  "COMPLETE",
];

type IntakeFilterKey = "awaitingIntakeReview";

type WorkflowQueueFilterKey =
  | IntakeFilterKey
  | "assessmentInProgress"
  | "documentsNeeded"
  | "stalled";

const INTAKE_FILTERS: {
  key: IntakeFilterKey;
  label: string;
  summaryLabel: string;
  countKey: "intakesAwaitingReview";
}[] = [
  {
    key: "awaitingIntakeReview",
    label: "Awaiting review",
    summaryLabel: "Awaiting Review",
    countKey: "intakesAwaitingReview",
  },
];

const WORKFLOW_QUEUE_FILTERS: {
  key: Exclude<WorkflowQueueFilterKey, IntakeFilterKey>;
  label: string;
  summaryLabel: string;
  countKey: keyof Pick<
    PipelineMetrics,
    "assessmentsInProgress" | "documentsNeeded" | "stalled"
  >;
  requiresDocuments?: boolean;
}[] = [
  {
    key: "assessmentInProgress",
    label: "assessment · in progress",
    summaryLabel: "assessment · in progress",
    countKey: "assessmentsInProgress",
  },
  {
    key: "documentsNeeded",
    label: "report · in progress",
    summaryLabel: "report · in progress",
    countKey: "documentsNeeded",
    requiresDocuments: true,
  },
  {
    key: "stalled",
    label: "Stalled",
    summaryLabel: "Stalled",
    countKey: "stalled",
  },
];

function WorkflowFilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-9 shrink-0 gap-2 rounded-full px-3.5 font-normal shadow-none",
        !active && "border-border/70 bg-background/60 hover:bg-muted/50",
        active && "shadow-sm",
      )}
    >
      <span className="whitespace-nowrap text-sm font-medium">{label}</span>
      <Badge
        variant={active ? "secondary" : "outline"}
        className="h-5 min-w-5 shrink-0 rounded-full px-1.5 text-[0.65rem] tabular-nums"
      >
        {count}
      </Badge>
    </Button>
  );
}

export function PipelineFilters({
  filters,
  onFilterChange,
  metrics,
  totalCount,
  filteredCount,
  page = 1,
  pageSize = 20,
  pseudonymousWorkspaceLabeling = false,
  documentRequirementsEnabled = true,
}: PipelineFiltersProps) {
  const searchCopy = pseudonymousWorkspaceLabeling
    ? PIPELINE_SEARCH_COPY.pseudonymous
    : PIPELINE_SEARCH_COPY.standard;
  const stageOptions = documentRequirementsEnabled
    ? stages
    : stages.filter((stage) => stage !== "DOCUMENTS_REQUIRED");
  const pageStart = filteredCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, filteredCount);
  const [searchValue, setSearchValue] = useState(filters.search || "");

  useEffect(() => {
    setSearchValue(filters.search || "");
  }, [filters.search]);

  const debouncedSearchChange = useDebouncedCallback((value: string) => {
    onFilterChange({ ...filters, search: value || undefined });
  }, 300);

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    debouncedSearchChange(value);
  };

  const handleStageChange = (value: string) => {
    const stage = value === "all" ? undefined : (value as ClientWorkflowStage);
    onFilterChange({ ...filters, stage });
  };

  const setWorkflowStatus = (inactive: boolean) => {
    if (inactive === Boolean(filters.inactive)) return;
    onFilterChange({
      ...filters,
      inactive: inactive ? true : undefined,
      stalled: undefined,
      awaitingIntakeReview: undefined,
      assessmentInProgress: undefined,
      documentsNeeded: undefined,
      stage: undefined,
    });
  };

  const toggleWorkflowQueueFilter = (key: WorkflowQueueFilterKey) => {
    onFilterChange({
      ...filters,
      [key]: filters[key] ? undefined : true,
      inactive: undefined,
    });
  };

  const activeFilterLabels: string[] = [];
  if (filters.stage) {
    activeFilterLabels.push(
      getAdvisorPipelineStageLabel(filters.stage, documentRequirementsEnabled),
    );
  }
  if (filters.search) activeFilterLabels.push(`"${filters.search}"`);
  for (const { key, summaryLabel } of INTAKE_FILTERS) {
    if (filters[key]) activeFilterLabels.push(summaryLabel);
  }
  for (const { key, summaryLabel, requiresDocuments } of WORKFLOW_QUEUE_FILTERS) {
    if (requiresDocuments && !documentRequirementsEnabled) continue;
    if (filters[key]) activeFilterLabels.push(summaryLabel);
  }
  if (filters.inactive) activeFilterLabels.push("Inactive");

  return (
    <div
      className="space-y-4 rounded-lg border border-border/70 bg-card p-4 shadow-sm"
      data-tour="pipeline-filters"
    >
      {/* Toolbar: search, active/inactive, stage */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            placeholder={searchCopy.placeholder}
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-10 pl-9"
            aria-label={searchCopy.ariaLabel}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
          <div
            className="inline-flex rounded-lg border border-border/70 bg-muted/20 p-0.5"
            role="group"
            aria-label="Client workflow status"
          >
            <Button
              type="button"
              variant={filters.inactive ? "ghost" : "default"}
              size="sm"
              className="h-9 rounded-md px-4"
              onClick={() => setWorkflowStatus(false)}
            >
              Active
            </Button>
            <Button
              type="button"
              variant={filters.inactive ? "default" : "ghost"}
              size="sm"
              className="h-9 rounded-md px-4"
              onClick={() => setWorkflowStatus(true)}
            >
              Inactive
              <Badge variant="secondary" className="ml-2 tabular-nums">
                {metrics.inactive}
              </Badge>
            </Button>
          </div>

          <Select value={filters.stage || "all"} onValueChange={handleStageChange}>
            <SelectTrigger className="h-10 w-full min-w-[11rem] sm:w-44">
              <SelectValue placeholder="Filter by stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  All Stages
                  <Badge variant="outline" className="ml-1 tabular-nums">
                    {totalCount}
                  </Badge>
                </div>
              </SelectItem>
              {stageOptions.map((stage) => (
                <SelectItem key={stage} value={stage}>
                  <div className="flex min-w-0 items-center gap-2">
                    <PipelineProcessStateLabel
                      stage={stage}
                      documentRequirementsEnabled={documentRequirementsEnabled}
                      className="min-w-0 truncate text-sm"
                    />
                    <Badge variant="outline" className="ml-auto shrink-0 tabular-nums">
                      {metrics.byStage[stage]}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quick workflow filters */}
      <div className="space-y-3 border-t border-border/50 pt-4">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Intake
          </p>
          <div className="flex flex-wrap gap-2">
            {INTAKE_FILTERS.map(({ key, label, countKey }) => (
              <WorkflowFilterChip
                key={key}
                label={label}
                count={metrics[countKey]}
                active={Boolean(filters[key])}
                onClick={() => toggleWorkflowQueueFilter(key)}
              />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Workflow
          </p>
          <div className="flex flex-wrap gap-2">
            {WORKFLOW_QUEUE_FILTERS.filter(
              (filter) => !filter.requiresDocuments || documentRequirementsEnabled,
            ).map(({ key, label, countKey }) => (
              <WorkflowFilterChip
                key={key}
                label={label}
                count={metrics[countKey]}
                active={Boolean(filters[key])}
                onClick={() => toggleWorkflowQueueFilter(key)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Results summary */}
      <p className="border-t border-border/50 pt-3 text-sm text-muted-foreground">
        {filteredCount === 0
          ? `No clients match (${totalCount} assigned)`
          : filteredCount <= pageSize
            ? `Showing ${filteredCount} of ${totalCount} clients`
            : `Showing ${pageStart}–${pageEnd} of ${filteredCount} matching (${totalCount} assigned)`}
        {activeFilterLabels.length > 0 ? (
          <span className="ml-1">
            · Filtered by{" "}
            <span className="font-medium text-foreground">
              {activeFilterLabels.join(", ")}
            </span>
          </span>
        ) : null}
      </p>
    </div>
  );
}
