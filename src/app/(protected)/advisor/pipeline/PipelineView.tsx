"use client";

import { usePipelineUpdates, usePipelineFilters } from "@/lib/pipeline/hooks";
import { PipelineFilters as PipelineFiltersBar } from "@/components/pipeline/PipelineFilters";
import { PipelineTable } from "@/components/pipeline/PipelineTable";
import type { PipelineClient, PipelineFilters, PipelineMetrics } from "@/lib/pipeline/types";

interface PipelineViewProps {
  initialClients: PipelineClient[];
  initialMetrics: PipelineMetrics;
  initialFilters?: PipelineFilters;
}

export function PipelineView({
  initialClients,
  initialMetrics,
  initialFilters,
}: PipelineViewProps) {
  // Real-time updates via SSE
  const { clients, connected, lastUpdated } = usePipelineUpdates(initialClients);

  // Client-side filtering and sorting
  const { filters, filteredClients, updateFilters } = usePipelineFilters(
    clients,
    initialFilters,
  );

  return (
    <div className="space-y-6">
      {/* Connection status indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div
            className={`w-2 h-2 rounded-full ${
              connected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span>
            {connected ? 'Live updates' : 'Connection lost'}
          </span>
          <span className="text-xs">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Filters */}
      <PipelineFiltersBar
        filters={filters}
        onFilterChange={updateFilters}
        metrics={initialMetrics} // Use initial metrics for filter counts
        totalCount={clients.length}
        filteredCount={filteredClients.length}
      />

      {/* Table */}
      <PipelineTable clients={filteredClients} />
    </div>
  );
}