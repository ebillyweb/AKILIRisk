"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import Link from "next/link";

import { PipelineClientCard } from "./PipelineClientCard";
import type { PipelineClient } from "@/lib/pipeline/types";
import { cn } from "@/lib/utils";

interface PipelineTableProps {
  clients: PipelineClient[];
  showDocumentsColumn?: boolean;
  monitoringEnabled?: boolean;
}

const columnHelper = createColumnHelper<PipelineClient>();

const SORT_HEADERS: { id: string; label: string }[] = [
  { id: "name", label: "Client" },
  { id: "stage", label: "Pipeline" },
  { id: "progress", label: "Progress" },
  { id: "lastActivity", label: "Last activity" },
];

export function PipelineTable({
  clients,
  showDocumentsColumn = true,
  monitoringEnabled = false,
}: PipelineTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "lastActivity", desc: true },
  ]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", { id: "name", enableSorting: true }),
      columnHelper.accessor("stage", { id: "stage", enableSorting: true }),
      columnHelper.accessor("progress", { id: "progress", enableSorting: true }),
      columnHelper.accessor("lastActivity", { id: "lastActivity", enableSorting: true }),
    ],
    [],
  );

  const table = useReactTable({
    data: clients,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
  });

  if (clients.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">No clients match your filters.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Try adjusting your search criteria or{" "}
          <Link
            href="/advisor/invitations"
            className="text-primary hover:underline"
          >
            invite a client
          </Link>{" "}
          to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-tour="pipeline-client-cards">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1">
        {SORT_HEADERS.map(({ id, label }) => {
          const column = table.getColumn(id);
          if (!column?.getCanSort()) return null;
          const sorted = column.getIsSorted();
          return (
            <button
              key={id}
              type="button"
              className={cn(
                "text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground",
                sorted && "text-foreground",
              )}
              onClick={column.getToggleSortingHandler()}
            >
              {label}
              {sorted === "asc" ? " ↑" : sorted === "desc" ? " ↓" : null}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {table.getRowModel().rows.map((row) => (
          <PipelineClientCard
            key={row.id}
            client={row.original}
            showDocumentsColumn={showDocumentsColumn}
            monitoringEnabled={monitoringEnabled}
          />
        ))}
      </div>
    </div>
  );
}
