"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { usePipelineUpdates, usePipelineFilters } from "@/lib/pipeline/hooks";
import { buildPipelineHref } from "@/lib/pipeline/parse-pipeline-filters";
import { PipelineFilters as PipelineFiltersBar } from "@/components/pipeline/PipelineFilters";
import { PipelineTable } from "@/components/pipeline/PipelineTable";
import type { PipelineClient, PipelineFilters, PipelineMetrics } from "@/lib/pipeline/types";

const PAGE_SIZE = 20;

interface PipelineViewProps {
  initialClients: PipelineClient[];
  initialMetrics: PipelineMetrics;
  initialFilters?: PipelineFilters;
  initialPage: number;
}

export function PipelineView({
  initialClients,
  initialMetrics,
  initialFilters,
  initialPage,
}: PipelineViewProps) {
  const router = useRouter();

  const viewingInactive = initialFilters?.inactive === true;

  // Real-time updates via SSE (active pipeline only)
  const { clients: liveClients, connected, lastUpdated } = usePipelineUpdates(
    viewingInactive ? [] : initialClients,
  );
  const clients = viewingInactive ? initialClients : liveClients;

  // Client-side filtering and sorting
  const { filters, filteredClients } = usePipelineFilters(
    clients,
    initialFilters,
  );

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, initialPage), totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pagedClients = useMemo(
    () => filteredClients.slice(pageStart, pageStart + PAGE_SIZE),
    [filteredClients, pageStart],
  );
  const hasNextPage = currentPage * PAGE_SIZE < filteredClients.length;

  const navigateWithFilters = (nextFilters: PipelineFilters, page = 1) => {
    router.push(buildPipelineHref(nextFilters, page));
  };

  const handleFilterChange = (nextFilters: PipelineFilters) => {
    navigateWithFilters(nextFilters, 1);
  };

  // Clamp URL when filters shrink the result set (e.g. page=3 but only 25 matches).
  useEffect(() => {
    if (initialPage > totalPages) {
      router.replace(buildPipelineHref(filters, totalPages));
    }
  }, [filters, initialPage, router, totalPages]);

  return (
    <div className="space-y-6">
      {/* Connection status indicator */}
      {!viewingInactive ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div
              className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
            />
            <span>{connected ? "Live updates" : "Connection lost"}</span>
            <span className="text-xs">Last updated: {lastUpdated.toLocaleTimeString()}</span>
          </div>
        </div>
      ) : null}

      {/* Filters */}
      <PipelineFiltersBar
        filters={filters}
        onFilterChange={handleFilterChange}
        metrics={initialMetrics}
        totalCount={clients.length}
        filteredCount={filteredClients.length}
        page={currentPage}
        pageSize={PAGE_SIZE}
      />

      {/* Table */}
      <PipelineTable clients={pagedClients} />

      {filteredClients.length > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Page {currentPage.toLocaleString()} of {totalPages.toLocaleString()}
            {" · "}
            Showing {pageStart + 1}–
            {Math.min(currentPage * PAGE_SIZE, filteredClients.length).toLocaleString()} of{" "}
            {filteredClients.length.toLocaleString()} matching
            {filteredClients.length !== clients.length
              ? ` (${clients.length.toLocaleString()} assigned)`
              : null}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {currentPage > 1 ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={buildPipelineHref(filters, currentPage - 1)}>← Previous page</Link>
              </Button>
            ) : null}
            {hasNextPage ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={buildPipelineHref(filters, currentPage + 1)}>Next page →</Link>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
