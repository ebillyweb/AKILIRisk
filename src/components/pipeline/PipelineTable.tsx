"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

import { StageIndicator } from "./StageIndicator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getStageLabel } from "@/lib/pipeline/status";
import type { PipelineClient, ClientWorkflowStage } from "@/lib/pipeline/types";

interface PipelineTableProps {
  clients: PipelineClient[];
}

const columnHelper = createColumnHelper<PipelineClient>();

function getStageBadgeVariant(stage: ClientWorkflowStage) {
  switch (stage) {
    case 'INVITED':
      return 'info' as const;
    case 'REGISTERED':
      return 'info' as const;
    case 'INTAKE_IN_PROGRESS':
      return 'warning' as const;
    case 'INTAKE_COMPLETE':
      return 'success' as const;
    case 'ASSESSMENT_IN_PROGRESS':
      return 'warning' as const;
    case 'ASSESSMENT_COMPLETE':
      return 'success' as const;
    case 'DOCUMENTS_REQUIRED':
      return 'warning' as const;
    case 'COMPLETE':
      return 'success' as const;
    default:
      return 'outline' as const;
  }
}

export function PipelineTable({ clients }: PipelineTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'lastActivity', desc: true }
  ]);

  // Responsive column visibility
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth < 640;
      const isTablet = window.innerWidth < 1024;
      return {
        stage: !isMobile, // Hide stage indicator on mobile
        documents: !isTablet, // Hide documents on small screens
      };
    }
    return { stage: true, documents: true };
  });

  const columns: ColumnDef<PipelineClient, any>[] = [
    columnHelper.accessor('name', {
      header: 'Client Name',
      cell: (info) => {
        const client = info.row.original;
        const displayName = client.name || 'Unnamed Client';

        return (
          <Link
            href={`/advisor/pipeline/${client.id}`}
            className="block space-y-1 cursor-pointer hover:bg-muted/50 rounded p-2 -m-2 transition-colors"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-primary hover:underline">
                {displayName}
              </span>
              {client.stalled && (
                <Badge variant="warning" className="text-xs">
                  Stalled
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{client.email}</p>
          </Link>
        );
      },
      enableSorting: true,
    }),
    columnHelper.accessor('stage', {
      id: 'stage',
      header: 'Stage',
      cell: (info) => (
        <StageIndicator currentStage={info.getValue()} />
      ),
      enableSorting: true,
    }),
    columnHelper.accessor('stage', {
      id: 'status',
      header: 'Status',
      cell: (info) => {
        const stage = info.getValue();
        return (
          <Badge variant={getStageBadgeVariant(stage)}>
            {getStageLabel(stage)}
          </Badge>
        );
      },
      enableSorting: true,
    }),
    columnHelper.accessor('progress', {
      header: 'Progress',
      cell: (info) => {
        const progress = info.getValue();
        return (
          <div className="flex items-center gap-2 min-w-[100px]">
            <Progress value={progress} className="flex-1" />
            <span className="text-xs text-muted-foreground w-8">
              {progress}%
            </span>
          </div>
        );
      },
      enableSorting: true,
    }),
    columnHelper.accessor('lastActivity', {
      header: 'Last Activity',
      cell: (info) => {
        const date = info.getValue();
        return (
          <span className="text-sm">
            {formatDistanceToNow(date, { addSuffix: true })}
          </span>
        );
      },
      enableSorting: true,
    }),
    columnHelper.accessor('documents', {
      id: 'documents',
      header: 'Documents',
      cell: (info) => {
        const docs = info.getValue();
        if (docs.required === 0) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <span className="text-sm">
            {docs.fulfilled}/{docs.required} req.
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
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          No clients match your filters.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Try adjusting your search criteria or{" "}
          <Link href="/advisor/invitations" className="text-primary hover:underline">
            invite a client
          </Link>{" "}
          to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="rounded-md border">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left font-medium text-muted-foreground"
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        {...{
                          className: header.column.getCanSort()
                            ? 'cursor-pointer select-none hover:text-foreground transition-colors'
                            : '',
                          onClick: header.column.getToggleSortingHandler(),
                        }}
                      >
                        {typeof header.column.columnDef.header === 'function'
                          ? header.column.columnDef.header(header.getContext())
                          : header.column.columnDef.header}
                        {{
                          asc: ' ↑',
                          desc: ' ↓',
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
                className="border-b last:border-b-0 hover:bg-muted/50 transition-colors"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3">
                    {typeof cell.column.columnDef.cell === 'function'
                      ? cell.column.columnDef.cell(cell.getContext())
                      : cell.getValue() as React.ReactNode}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}