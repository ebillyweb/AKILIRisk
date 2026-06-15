"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { useState, type ReactNode } from "react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

import { StageProgressBar } from "./StageIndicator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getStageLabel } from "@/lib/pipeline/status";
import type { PipelineClient, ClientWorkflowStage } from "@/lib/pipeline/types";
import { cn } from "@/lib/utils";

interface PipelineTableProps {
  clients: PipelineClient[];
}

const columnHelper = createColumnHelper<PipelineClient>();

function getStageBadgeVariant(stage: ClientWorkflowStage) {
  switch (stage) {
    case "INVITED":
      return "info" as const;
    case "REGISTERED":
      return "info" as const;
    case "INTAKE_IN_PROGRESS":
      return "warning" as const;
    case "INTAKE_COMPLETE":
      return "success" as const;
    case "ASSESSMENT_IN_PROGRESS":
      return "warning" as const;
    case "ASSESSMENT_COMPLETE":
      return "success" as const;
    case "DOCUMENTS_REQUIRED":
      return "warning" as const;
    case "COMPLETE":
      return "success" as const;
    default:
      return "outline" as const;
  }
}

export function PipelineTable({ clients }: PipelineTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "lastActivity", desc: true },
  ]);

  const [columnVisibility, setColumnVisibility] = useState<
    Record<string, boolean>
  >(() => {
    if (typeof window !== "undefined") {
      const isTablet = window.innerWidth < 1024;
      return {
        documents: !isTablet,
      };
    }
    return { documents: true };
  });

  const columns = [
    columnHelper.accessor("name", {
      header: "Client",
      cell: (info) => {
        const client = info.row.original;
        const displayName = client.name || "Unnamed Client";

        return (
          <Link
            href={`/advisor/pipeline/${client.id}`}
            className="-m-1 block min-w-0 rounded-md p-1 transition-colors hover:bg-muted/50"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium text-primary hover:underline">
                {displayName}
              </span>
              {client.needsRescore ? (
                <Badge variant="warning" className="shrink-0 text-[0.65rem]">
                  Reassessment
                </Badge>
              ) : null}
              {client.stalled ? (
                <Badge variant="warning" className="shrink-0 text-[0.65rem]">
                  Stalled
                </Badge>
              ) : null}
            </div>
            <p
              className="mt-0.5 truncate text-sm text-muted-foreground"
              title={client.email}
            >
              {client.email}
            </p>
          </Link>
        );
      },
      enableSorting: true,
    }),
    columnHelper.accessor("stage", {
      id: "stage",
      header: "Stage",
      cell: (info) => {
        const stage = info.getValue();
        return (
          <div className="min-w-[8.5rem] space-y-2">
            <Badge
              variant={getStageBadgeVariant(stage)}
              className="whitespace-nowrap text-[0.65rem] font-semibold uppercase tracking-wide"
            >
              {getStageLabel(stage)}
            </Badge>
            <StageProgressBar currentStage={stage} />
          </div>
        );
      },
      enableSorting: true,
    }),
    columnHelper.accessor("progress", {
      header: "Progress",
      cell: (info) => {
        const progress = info.getValue();
        return (
          <div className="flex min-w-[6.5rem] items-center gap-2">
            <Progress value={progress} className="h-2 min-w-[4rem] flex-1" />
            <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {progress}%
            </span>
          </div>
        );
      },
      enableSorting: true,
    }),
    columnHelper.accessor("lastActivity", {
      header: "Last activity",
      cell: (info) => {
        const date = info.getValue();
        return (
          <span className="whitespace-nowrap text-sm text-foreground">
            {formatDistanceToNow(date, { addSuffix: true })}
          </span>
        );
      },
      enableSorting: true,
    }),
    columnHelper.accessor("documents", {
      id: "documents",
      header: "Docs",
      cell: (info) => {
        const docs = info.getValue();
        if (docs.required === 0) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <span className="whitespace-nowrap text-sm tabular-nums">
            {docs.fulfilled}/{docs.required}
          </span>
        );
      },
      enableSorting: false,
    }),
  ];

  const table = useReactTable({
    data: clients,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnVisibility,
    },
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
    <div className="w-full overflow-x-auto rounded-md border">
      <table className="w-full min-w-[48rem] border-collapse text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b bg-muted/30">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {header.isPlaceholder ? null : (
                    <div
                      className={cn(
                        header.column.getCanSort() &&
                          "cursor-pointer select-none transition-colors hover:text-foreground"
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {typeof header.column.columnDef.header === "function"
                        ? header.column.columnDef.header(header.getContext())
                        : header.column.columnDef.header}
                      {{
                        asc: " ↑",
                        desc: " ↓",
                      }[header.column.getIsSorted() as string] ?? null}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="border-b last:border-b-0 transition-colors hover:bg-muted/40"
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3.5 align-top">
                  {typeof cell.column.columnDef.cell === "function"
                    ? cell.column.columnDef.cell(cell.getContext())
                    : (cell.getValue() as ReactNode)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
