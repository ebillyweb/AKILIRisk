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
import { getStageLabel } from "@/lib/pipeline/status";
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

type WorkflowFilterKey =
  | "documentsNeeded"
  | "awaitingIntakeReview"
  | "needsRescore"
  | "stalled";

const WORKFLOW_FILTERS: {
  key: WorkflowFilterKey;
  label: string;
  countKey: keyof Pick<
    PipelineMetrics,
    "documentsNeeded" | "intakesAwaitingReview" | "needsRescore" | "stalled"
  >;
}[] = [
  { key: "documentsNeeded", label: "Documents Needed", countKey: "documentsNeeded" },
  { key: "awaitingIntakeReview", label: "Awaiting Review", countKey: "intakesAwaitingReview" },
  { key: "needsRescore", label: "Reassessments", countKey: "needsRescore" },
  { key: "stalled", label: "Stalled", countKey: "stalled" },
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
        "h-auto min-h-10 w-full justify-between gap-3 px-3 py-2.5 text-left font-normal",
        !active && "bg-background/60 hover:bg-muted/50",
      )}
    >
      <span className="text-sm font-medium leading-snug">{label}</span>
      <Badge
        variant={active ? "secondary" : "outline"}
        className="shrink-0 tabular-nums"
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
}: PipelineFiltersProps) {
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
      documentsNeeded: undefined,
      needsRescore: undefined,
      stage: undefined,
    });
  };

  const toggleFlag = (key: WorkflowFilterKey | "inactive") => {
    if (key === "inactive") {
      onFilterChange({
        ...filters,
        inactive: filters.inactive ? undefined : true,
        stalled: undefined,
        awaitingIntakeReview: undefined,
        documentsNeeded: undefined,
        needsRescore: undefined,
        stage: undefined,
      });
      return;
    }
    onFilterChange({
      ...filters,
      [key]: filters[key] ? undefined : true,
      inactive: undefined,
    });
  };

  const activeFilterLabels: string[] = [];
  if (filters.stage) activeFilterLabels.push(getStageLabel(filters.stage));
  if (filters.search) activeFilterLabels.push(`"${filters.search}"`);
  if (filters.stalled) activeFilterLabels.push("Stalled");
  if (filters.awaitingIntakeReview) activeFilterLabels.push("Awaiting Review");
  if (filters.documentsNeeded) activeFilterLabels.push("Documents Needed");
  if (filters.needsRescore) activeFilterLabels.push("Reassessments");
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
            placeholder="Search by name or email..."
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-10 pl-9"
            aria-label="Search clients by name or email"
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
              {stages.map((stage) => (
                <SelectItem key={stage} value={stage}>
                  <div className="flex items-center gap-2">
                    {getStageLabel(stage)}
                    <Badge variant="outline" className="ml-1 tabular-nums">
                      {metrics.byStage[stage]}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Workflow attention filters — equal-width grid */}
      <div className="space-y-2 border-t border-border/50 pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Needs attention
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {WORKFLOW_FILTERS.map(({ key, label, countKey }) => (
            <WorkflowFilterChip
              key={key}
              label={label}
              count={metrics[countKey]}
              active={Boolean(filters[key])}
              onClick={() => toggleFlag(key)}
            />
          ))}
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
