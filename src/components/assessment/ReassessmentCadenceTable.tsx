"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ReassessmentDialog } from "@/components/assessment/ReassessmentDialog";
import { ReviewCadencePanel } from "@/components/engagement/ReviewCadencePanel";
import type { ReassessmentCadenceClientRow } from "@/lib/cadence/advisor-reassessment-portfolio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function cadenceBadge(status: ReassessmentCadenceClientRow["cadence"]) {
  if (!status) {
    return <Badge variant="outline">Not scheduled</Badge>;
  }
  switch (status.status) {
    case "overdue":
      return (
        <Badge
          variant="default"
          className="border-transparent bg-destructive text-destructive-foreground"
        >
          Overdue
        </Badge>
      );
    case "due_soon":
      return <Badge variant="warning">Due soon</Badge>;
    case "system_recommended":
      return <Badge variant="info">Recommended</Badge>;
    default:
      return <Badge variant="outline">On track</Badge>;
  }
}

export function ReassessmentCadenceTable({
  rows,
}: {
  rows: ReassessmentCadenceClientRow[];
}) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No clients with a completed assessment yet. Reassessment cadence appears
        once clients finish their first assessment.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Client</TableHead>
          <TableHead>Last completed</TableHead>
          <TableHead>Cadence</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.clientId}>
            <TableCell className="font-medium">
              <Link href={row.pipelineHref} className="hover:underline">
                {row.clientName}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {row.assessmentCompletedAt
                ? format(row.assessmentCompletedAt, "MMM d, yyyy")
                : "—"}
            </TableCell>
            <TableCell>{cadenceBadge(row.cadence)}</TableCell>
            <TableCell className="text-right">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={row.pipelineHref}>View client</Link>
                </Button>
                <ReassessmentDialog
                  assessmentId={row.assessmentId}
                  targetedQuestionCount={row.targetedQuestionCount}
                  triggerLabel="Start reassessment"
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ReassessmentCadenceDetailPanel({
  row,
}: {
  row: ReassessmentCadenceClientRow;
}) {
  return (
    <div className="space-y-4">
      <ReviewCadencePanel cadence={row.cadence} clientId={row.clientId} />
      <ReassessmentDialog
        assessmentId={row.assessmentId}
        targetedQuestionCount={row.targetedQuestionCount}
      />
    </div>
  );
}
