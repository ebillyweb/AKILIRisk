"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, FileText, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { AdvisorDashboardClient } from "@/lib/advisor/types";
import { TOTAL_QUESTIONS } from "@/lib/intake/questions";

interface ClientCardProps {
  client: AdvisorDashboardClient;
}

// Round-11 commit 2.1 (BRD §5.1 amendment): the clientProfile.phone +
// city/state/country block was removed; ClientProfile no longer carries
// those columns.

export function ClientCard({ client }: ClientCardProps) {
  const { id, name, email, assignedAt, latestInterview } = client;
  const router = useRouter();

  // Status badge configuration
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'NOT_STARTED':
        return {
          label: 'Not Started',
          className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
        };
      case 'IN_PROGRESS':
        return {
          label: 'In Progress',
          className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
        };
      case 'COMPLETED':
        return {
          label: 'Completed',
          className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
        };
      case 'SUBMITTED':
        return {
          label: 'Submitted',
          className: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
        };
      default:
        return {
          label: status,
          className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
        };
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  return (
    <Card className="h-full transition-colors hover:bg-muted/30">
      <CardHeader
        className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => router.push(`/advisor/pipeline/${id}`)}
        role="button"
        tabIndex={0}
        aria-label={`View pipeline for ${name || "Unnamed Client"}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            router.push(`/advisor/pipeline/${id}`);
          }
        }}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/20">
            <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-medium leading-none">
              {name || "Unnamed Client"}
            </h3>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {email}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Round-11 commit 2.1: the per-client phone + location row
            was rendered from ClientProfile.phone + city/state/country,
            all of which were dropped from the schema. Card now jumps
            straight to the assignment-info row. */}

        {/* Assignment info */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Assigned {formatDate(assignedAt)}</span>
        </div>

        {/* Intake status */}
        {latestInterview ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Intake Status</span>
              </div>
              <div className={`rounded-full px-2 py-1 text-xs font-medium ${
                getStatusConfig(latestInterview.status).className
              }`}>
                {getStatusConfig(latestInterview.status).label}
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              {latestInterview.responseCount}/{TOTAL_QUESTIONS} questions answered
            </div>

            {/* Action button: view intake form and listen to responses */}
            {latestInterview.status === 'SUBMITTED' ? (
              <Button asChild size="sm" className="w-full">
                <Link href={`/advisor/review/${latestInterview.id}`} title="View intake form and listen to responses">
                  View intake
                </Link>
              </Button>
            ) : (
              <div className="text-center py-2">
                <span className="text-sm text-muted-foreground">Awaiting intake</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Intake Status</span>
            </div>
            <div className="text-center py-2">
              <span className="text-sm text-muted-foreground">No intake started</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}