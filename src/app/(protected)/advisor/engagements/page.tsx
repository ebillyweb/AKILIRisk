import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  isAdvisorHubNavRole,
  normalizeUserRoleString,
} from "@/lib/auth-roles";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ENGAGEMENT_STATUS_LABELS,
  ENGAGEMENT_STATUS_VARIANT,
} from "./_status";

/**
 * BRD §6.3 / Epic 5.10 US-75 — Advisor engagement workspace.
 *
 * Lists every PortfolioEngagement assigned to the signed-in advisor with
 * the current status, the client's name, and the date the client accepted
 * the recommendation. Status advancement happens on the detail page.
 *
 * Open engagements (every status except COMPLETE / DECLINED) are listed
 * first; closed engagements follow underneath in a separate card so the
 * advisor's queue is always at the top.
 */
export default async function AdvisorEngagementsPage() {
  const session = await auth();
  const role = normalizeUserRoleString(session?.user?.role);
  if (!session?.user?.id || !isAdvisorHubNavRole(role)) {
    redirect("/dashboard?error=unauthorized");
  }

  const engagements = await prisma.portfolioEngagement.findMany({
    where: role === "ADVISOR" ? { advisorId: session.user.id } : undefined,
    select: {
      id: true,
      status: true,
      acceptedAt: true,
      meetingScheduledAt: true,
      meetingAt: true,
      completedAt: true,
      assessmentId: true,
      client: { select: { name: true, firstName: true, lastName: true } },
    },
    orderBy: [{ acceptedAt: "desc" }],
  });

  const open = engagements.filter(
    (e) => e.status !== "COMPLETE" && e.status !== "DECLINED"
  );
  const closed = engagements.filter(
    (e) => e.status === "COMPLETE" || e.status === "DECLINED"
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="space-y-1">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">
          Workflows
        </p>
        <h1 className="text-3xl font-semibold">Engagements</h1>
        <p className="text-sm text-muted-foreground">
          Clients who have accepted the recommendation on their Risk Profile.
          Advance status as work progresses through scheduling, execution,
          and completion.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Open engagements</CardTitle>
          <CardDescription>
            {open.length === 0
              ? "No open engagements right now."
              : `${open.length} engagement${open.length === 1 ? "" : "s"} awaiting your attention.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {open.length === 0 ? null : <EngagementList rows={open} />}
        </CardContent>
      </Card>

      {closed.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Closed</CardTitle>
            <CardDescription>
              Completed or declined engagements, most recent first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EngagementList rows={closed} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function clientName(c: {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
}): string {
  if (c.firstName || c.lastName) {
    return [c.firstName, c.lastName].filter(Boolean).join(" ");
  }
  return c.name ?? "Client";
}

function EngagementList({
  rows,
}: {
  rows: Array<{
    id: string;
    status: keyof typeof ENGAGEMENT_STATUS_LABELS;
    acceptedAt: Date;
    meetingScheduledAt: Date | null;
    meetingAt: Date | null;
    completedAt: Date | null;
    assessmentId: string;
    client: {
      name: string | null;
      firstName: string | null;
      lastName: string | null;
    };
  }>;
}) {
  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => {
        const meetingDate = r.meetingAt ?? r.meetingScheduledAt;
        return (
          <li key={r.id} className="py-4">
            <Link
              href={`/advisor/engagements/${r.id}`}
              className="flex flex-col gap-2 rounded-md px-2 py-2 transition hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-base font-medium">
                  {clientName(r.client)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Accepted {format(r.acceptedAt, "MMM d, yyyy")}
                  {meetingDate
                    ? ` · Meeting ${format(meetingDate, "MMM d, yyyy")}`
                    : ""}
                  {r.completedAt
                    ? ` · Completed ${format(r.completedAt, "MMM d, yyyy")}`
                    : ""}
                </p>
              </div>
              <Badge variant={ENGAGEMENT_STATUS_VARIANT[r.status]}>
                {ENGAGEMENT_STATUS_LABELS[r.status]}
              </Badge>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
