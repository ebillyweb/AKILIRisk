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
import { format } from "date-fns";
import Link from "next/link";
import type { DashboardClient } from "@/lib/dashboard/types";
import { ScoreBadge } from "./ScoreBadge";
import { Badge } from "@/components/ui/badge";

interface GovernanceTableProps {
  clients: DashboardClient[];
}

const columnHelper = createColumnHelper<DashboardClient>();

export function GovernanceTable({ clients }: GovernanceTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'score', desc: true }, // Default sort by score descending (null scores at top)
  ]);

  // Responsive column visibility - hide assessments and date on mobile
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      return { assessments: false, lastAssessment: false };
    }
    return { assessments: true, lastAssessment: true };
  });

  const getRiskSeverityOrder = (riskLevel: string | null) => {
    switch (riskLevel) {
      case 'CRITICAL': return 4;
      case 'HIGH': return 3;
      case 'MEDIUM': return 2;
      case 'LOW': return 1;
      default: return 0; // null sorts last
    }
  };

  const getBadgeVariant = (riskLevel: string) => {
    switch (riskLevel) {
      case 'LOW':
        return 'success' as const;
      case 'MEDIUM':
        return 'warning' as const;
      case 'HIGH':
        return 'warning' as const;
      case 'CRITICAL':
        return 'outline' as const;
      default:
        return 'outline' as const;
    }
  };

  const columns: ColumnDef<DashboardClient, any>[] = [
    columnHelper.accessor('name', {
      header: 'Family Name',
      cell: (info) => {
        const client = info.row.original;
        const familyName = info.getValue() || 'Unnamed Family';

        // Only link families that have at least 1 completed assessment
        if (client.assessmentCount > 0) {
          return (
            <Link
              href={`/advisor/analytics/${client.id}`}
              className="hover:underline text-primary"
            >
              {familyName}
            </Link>
          );
        }

        return familyName;
      },
      enableSorting: true,
    }),
    columnHelper.accessor(
      (row) => row.latestScore?.score ?? null,
      {
        id: 'score',
        header: 'Risk Score',
        cell: (info) => {
          const client = info.row.original;
          return (
            <ScoreBadge
              score={client.latestScore?.score ?? null}
              riskLevel={client.latestScore?.riskLevel ?? null}
            />
          );
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const scoreA = rowA.original.latestScore?.score ?? null;
          const scoreB = rowB.original.latestScore?.score ?? null;

          // null scores sort to top (unassessed families first)
          if (scoreA === null && scoreB === null) return 0;
          if (scoreA === null) return -1;
          if (scoreB === null) return 1;

          return scoreA - scoreB;
        },
      }
    ),
    columnHelper.accessor(
      (row) => row.latestScore?.riskLevel ?? null,
      {
        id: 'riskLevel',
        header: 'Risk Level',
        cell: (info) => {
          const riskLevel = info.getValue();
          if (!riskLevel) return <span className="text-muted-foreground">N/A</span>;

          return (
            <Badge variant={getBadgeVariant(riskLevel)}>
              {riskLevel}
            </Badge>
          );
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const levelA = rowA.original.latestScore?.riskLevel ?? null;
          const levelB = rowB.original.latestScore?.riskLevel ?? null;

          return getRiskSeverityOrder(levelA) - getRiskSeverityOrder(levelB);
        },
      }
    ),
    columnHelper.accessor('assessmentCount', {
      id: 'assessments',
      header: 'Assessments',
      cell: (info) => info.getValue(),
      enableSorting: true,
    }),
    columnHelper.accessor('latestAssessmentDate', {
      id: 'lastAssessment',
      header: 'Last Assessment',
      cell: (info) => {
        const date = info.getValue();
        return date ? format(date, 'MMM d, yyyy') : 'No assessments';
      },
      enableSorting: true,
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
      <div className="text-center py-8">
        <p className="text-muted-foreground">
          No clients assigned yet. Contact your administrator to get started.
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
                    className="px-4 py-2 text-left font-medium text-muted-foreground"
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        {...{
                          className: header.column.getCanSort()
                            ? 'cursor-pointer select-none'
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
              <tr key={row.id} className="border-b last:border-b-0 hover:bg-muted/50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-2">
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