"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  type SortingState,
  type ColumnDef,
} from "@tanstack/react-table";
import { useMemo, useState, type ReactNode } from "react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

import { StageProgressBar } from "./StageIndicator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { STALE_SCORES_COPY } from "@/lib/advisor/assessment-lifecycle-copy";
import {
  getAdvisorPipelineStageLabel,
  resolveAdvisorPipelineDisplayStage,
} from "@/lib/pipeline/status";
import {
  formatPipelineClientRowTitle,
  resolveAdvisorClientPipelineLabels,
} from "@/lib/pipeline/client-display";
import type { PipelineClient, ClientWorkflowStage } from "@/lib/pipeline/types";
import { cn } from "@/lib/utils";

interface PipelineTableProps {
  clients: PipelineClient[];
  showDocumentsColumn?: boolean;
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

export function PipelineTable({
  clients,
  showDocumentsColumn = true,
}: PipelineTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "lastActivity", desc: true },
  ]);

  const columns = useMemo(() => {
    const baseColumns: ColumnDef<PipelineClient, unknown>[] = [
      columnHelper.accessor("name", {
        header: "Client",
        cell: (info) => {
          const client = info.row.original;
          const { headline, secondary } = resolveAdvisorClientPipelineLabels(client);

          return (
            <div className="-m-1 min-w-0 max-w-full rounded-md p-1">
              <Link
                href={`/advisor/pipeline/${client.id}`}
                className="block transition-colors hover:bg-muted/50 rounded-md p-0"
                title={formatPipelineClientRowTitle(client)}
              >
                <p className="truncate font-medium text-primary hover:underline">
                  {headline}
                </p>
                {secondary ? (
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {secondary}
                  </p>
                ) : null}
                {client.staleScores || client.stalled ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {client.staleScores ? (
                      <Badge variant="warning" className="max-w-full truncate text-[0.65rem]">
                        {STALE_SCORES_COPY.tableBadge}
                      </Badge>
                    ) : null}
                    {client.stalled ? (
                      <Badge variant="warning" className="max-w-full truncate text-[0.65rem]">
                        Stalled
                      </Badge>
                    ) : null}
                  </div>
                ) : null}
              </Link>
            </div>
          );
        },
        enableSorting: true,
      }),
      columnHelper.accessor("stage", {
        id: "stage",
        header: "Stage",
        cell: (info) => {
          const stage = info.getValue();
          const displayStage = resolveAdvisorPipelineDisplayStage(
            stage,
            showDocumentsColumn,
          );
          const stageLabel = getAdvisorPipelineStageLabel(stage, showDocumentsColumn);
          return (
            <div className="min-w-0 space-y-2">
              <div className="min-w-0 overflow-hidden" title={stageLabel}>
                <Badge
                  variant={getStageBadgeVariant(displayStage)}
                  className="max-w-full truncate text-[0.65rem] font-semibold uppercase tracking-wide"
                >
                  {stageLabel}
                </Badge>
              </div>
              <StageProgressBar
                currentStage={stage}
                showDocumentsStage={showDocumentsColumn}
              />
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
            <div className="flex min-w-0 items-center gap-2">
              <Progress value={progress} className="h-2 min-w-0 flex-1" />
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
          const label = formatDistanceToNow(date, { addSuffix: true });
          return (
            <span
              className="block truncate text-sm text-foreground"
              title={label}
            >
              {label}
            </span>
          );
        },
        enableSorting: true,
      }),
    ];

    if (showDocumentsColumn) {
      baseColumns.push(
        columnHelper.accessor("documents", {
          id: "documents",
          header: "Docs",
          cell: (info) => {
            const docs = info.getValue();
            if (docs.required === 0) {
              return <span className="text-muted-foreground">—</span>;
            }
            return (
              <span
                className="block truncate text-sm tabular-nums"
                title={`${docs.fulfilled}/${docs.required} documents`}
              >
                {docs.fulfilled}/{docs.required}
              </span>
            );
          },
          enableSorting: false,
        }),
      );
    }

    return baseColumns;
  }, [showDocumentsColumn]);

  const table = useReactTable({
    data: clients,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
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

  const columnWidths: Record<string, string> = {
    name: showDocumentsColumn ? "w-[34%]" : "w-[38%]",
    stage: showDocumentsColumn ? "w-[22%]" : "w-[24%]",
    progress: showDocumentsColumn ? "w-[16%]" : "w-[18%]",
    lastActivity: showDocumentsColumn ? "w-[20%]" : "w-[20%]",
    documents: "w-[8%]",
  };

  return (
    <div className="w-full overflow-hidden rounded-md border">
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b bg-muted/30">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className={cn(
                    "overflow-hidden px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground sm:px-4",
                    columnWidths[header.column.id] ?? columnWidths[header.id],
                  )}
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
                <td
                  key={cell.id}
                  className={cn(
                    "overflow-hidden px-3 py-3.5 align-top sm:px-4",
                    columnWidths[cell.column.id],
                  )}
                >
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
