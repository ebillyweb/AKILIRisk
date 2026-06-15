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
  'INVITED',
  'REGISTERED',
  'INTAKE_IN_PROGRESS',
  'INTAKE_COMPLETE',
  'ASSESSMENT_IN_PROGRESS',
  'ASSESSMENT_COMPLETE',
  'DOCUMENTS_REQUIRED',
  'COMPLETE',
];

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

  // Debounce search input
  const debouncedSearchChange = useDebouncedCallback(
    (value: string) => {
      onFilterChange({ ...filters, search: value || undefined });
    },
    300
  );

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    debouncedSearchChange(value);
  };

  const handleStageChange = (value: string) => {
    const stage = value === 'all' ? undefined : value as ClientWorkflowStage;
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

  const toggleFlag = (
    key: "stalled" | "awaitingIntakeReview" | "documentsNeeded" | "needsRescore" | "inactive",
  ) => {
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-md border border-border/70 p-0.5"
            role="group"
            aria-label="Client workflow status"
          >
            <Button
              type="button"
              variant={filters.inactive ? "ghost" : "default"}
              size="sm"
              className="h-8 rounded-sm px-3"
              onClick={() => setWorkflowStatus(false)}
            >
              Active
            </Button>
            <Button
              type="button"
              variant={filters.inactive ? "default" : "ghost"}
              size="sm"
              className="h-8 rounded-sm px-3"
              onClick={() => setWorkflowStatus(true)}
            >
              Inactive
              <Badge variant="secondary" className="ml-2">
                {metrics.inactive}
              </Badge>
            </Button>
          </div>
          <Button
            type="button"
            variant={filters.stalled ? "default" : "outline"}
            size="sm"
            onClick={() => toggleFlag("stalled")}
          >
            Stalled
            <Badge variant="secondary" className="ml-2">
              {metrics.stalled}
            </Badge>
          </Button>
          <Button
            type="button"
            variant={filters.awaitingIntakeReview ? "default" : "outline"}
            size="sm"
            onClick={() => toggleFlag("awaitingIntakeReview")}
          >
            Awaiting review
            <Badge variant="secondary" className="ml-2">
              {metrics.intakesAwaitingReview}
            </Badge>
          </Button>
          <Button
            type="button"
            variant={filters.documentsNeeded ? "default" : "outline"}
            size="sm"
            onClick={() => toggleFlag("documentsNeeded")}
          >
            Docs needed
            <Badge variant="secondary" className="ml-2">
              {metrics.documentsNeeded}
            </Badge>
          </Button>
          <Button
            type="button"
            variant={filters.needsRescore ? "default" : "outline"}
            size="sm"
            onClick={() => toggleFlag("needsRescore")}
          >
            Reassessment
            <Badge variant="secondary" className="ml-2">
              {metrics.needsRescore}
            </Badge>
          </Button>
          <Select
            value={filters.stage || 'all'}
            onValueChange={handleStageChange}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  All Stages
                  <Badge variant="outline" className="ml-1">
                    {totalCount}
                  </Badge>
                </div>
              </SelectItem>
              {stages.map((stage) => (
                <SelectItem key={stage} value={stage}>
                  <div className="flex items-center gap-2">
                    {getStageLabel(stage)}
                    <Badge variant="outline" className="ml-1">
                      {metrics.byStage[stage]}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        {filteredCount === 0
          ? `No clients match (${totalCount} assigned)`
          : filteredCount <= pageSize
            ? `Showing ${filteredCount} of ${totalCount} clients`
            : `Showing ${pageStart}–${pageEnd} of ${filteredCount} matching (${totalCount} assigned)`}
        {filters.stage && (
          <span className="ml-2">
            • Filtered by: <span className="font-medium">{getStageLabel(filters.stage)}</span>
          </span>
        )}
        {filters.search && (
          <span className="ml-2">
            • Search: <span className="font-medium">"{filters.search}"</span>
          </span>
        )}
        {filters.stalled && (
          <span className="ml-2">
            • <span className="font-medium">Stalled only</span>
          </span>
        )}
        {filters.awaitingIntakeReview && (
          <span className="ml-2">
            • <span className="font-medium">Awaiting intake review</span>
          </span>
        )}
        {filters.documentsNeeded && (
          <span className="ml-2">
            • <span className="font-medium">Required documents outstanding</span>
          </span>
        )}
        {filters.needsRescore && (
          <span className="ml-2">
            • <span className="font-medium">Reassessment needed</span>
          </span>
        )}
        {filters.inactive && (
          <span className="ml-2">
            • <span className="font-medium">Inactive only</span>
          </span>
        )}
      </div>
    </div>
  );
}