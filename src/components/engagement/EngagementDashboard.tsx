import { format } from "date-fns";
import {
  getEngagementMetrics,
  getEngagementClients,
  getUpcomingMilestones,
} from "@/lib/engagement/engagement-metrics";
import { EngagementMetricsCards } from "@/components/engagement/EngagementMetrics";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MilestoneStatusBadge } from "@/components/engagement/MilestoneStatusBadge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

type EngagementDashboardProps = {
  advisorProfileId: string;
};

export async function EngagementDashboard({
  advisorProfileId,
}: EngagementDashboardProps) {
  const [metrics, allClients, stalledClients, upcomingMilestones] =
    await Promise.all([
      getEngagementMetrics(advisorProfileId),
      getEngagementClients(advisorProfileId, "all"),
      getEngagementClients(advisorProfileId, "stalled"),
      getUpcomingMilestones(advisorProfileId, 30),
    ]);

  if (metrics.activeClientCount === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-12 text-center">
        <p className="text-sm font-medium text-foreground">
          No published action plans
        </p>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
          Publish a client&apos;s Strategic Action Plan from their guidance page
          to begin tracking implementation progress.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <EngagementMetricsCards metrics={metrics} />

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Clients</TabsTrigger>
          <TabsTrigger value="stalled">Stalled</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming Milestones</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <ClientTable clients={allClients} />
        </TabsContent>

        <TabsContent value="stalled" className="mt-6">
          {stalledClients.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No stalled clients. All active clients have recent milestone
              activity.
            </p>
          ) : (
            <>
              <ClientTable clients={stalledClients} highlightStalled />
              <p className="mt-3 text-xs text-muted-foreground">
                No milestone activity in the last 14 days
              </p>
            </>
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="mt-6">
          {upcomingMilestones.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No milestones due in the next 30 days.
            </p>
          ) : (
            <div className="space-y-4">
              {upcomingMilestones.map((ms) => (
                <div
                  key={ms.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border/60 px-4 py-3"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium text-foreground truncate">
                      {ms.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ms.recommendationName} &middot; {ms.clientName}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <MilestoneStatusBadge status={ms.status} />
                    <span className="text-xs text-muted-foreground tabular-nums">
                      Due {format(new Date(ms.dueDate), "MMM d")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ClientTable({
  clients,
  highlightStalled,
}: {
  clients: { clientId: string; clientName: string; completionPct: number; lastActivityAt: Date | null; blockedCount: number; isStalled: boolean }[];
  highlightStalled?: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Client Name</TableHead>
          <TableHead className="text-right">Completion %</TableHead>
          <TableHead>Last Activity</TableHead>
          <TableHead className="text-right">Blocked</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((client) => (
          <TableRow
            key={client.clientId}
            className={
              highlightStalled && client.isStalled ? "bg-chart-5/5" : undefined
            }
          >
            <TableCell className="font-medium">{client.clientName}</TableCell>
            <TableCell className="text-right tabular-nums">
              {client.completionPct}%
            </TableCell>
            <TableCell className="text-muted-foreground">
              {client.lastActivityAt
                ? format(new Date(client.lastActivityAt), "MMM d, yyyy")
                : "--"}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {client.blockedCount > 0 ? (
                <span className="text-destructive">{client.blockedCount}</span>
              ) : (
                "0"
              )}
            </TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="sm" asChild>
                <Link
                  href={`/advisor/clients/${client.clientId}/guidance`}
                  className="inline-flex items-center gap-1 text-xs"
                >
                  View
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
