import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeUserRoleString } from "@/lib/auth-roles";
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
} from "../_status";
import { EngagementStatusForm } from "./EngagementStatusForm";

/**
 * BRD §6.3 / Epic 5.10 US-75 — Advisor engagement detail page.
 *
 * Shows the engagement summary + a status-advancement form. The form
 * itself is a client component that wraps the `updateEngagementStatus`
 * server action with a small status-aware UI: only the allowed next
 * states for the current status appear as buttons.
 */
export default async function AdvisorEngagementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const role = normalizeUserRoleString(session?.user?.role);
  if (!session?.user?.id || role !== "ADVISOR") {
    redirect("/dashboard?error=unauthorized");
  }

  const { id } = await params;
  const engagement = await prisma.portfolioEngagement.findUnique({
    where: { id },
    include: {
      client: {
        select: { name: true, firstName: true, lastName: true },
      },
      assessment: {
        select: { id: true, completedAt: true, profileEnteredAt: true },
      },
    },
  });
  if (!engagement) notFound();
  if (engagement.advisorId !== session.user.id) {
    redirect("/advisor/engagements");
  }

  const displayName =
    [engagement.client.firstName, engagement.client.lastName]
      .filter(Boolean)
      .join(" ") || engagement.client.name || "Client";

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="space-y-2">
        <Link
          href="/advisor/engagements"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to engagements
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-semibold">{displayName}</h1>
          <Badge variant={ENGAGEMENT_STATUS_VARIANT[engagement.status]}>
            {ENGAGEMENT_STATUS_LABELS[engagement.status]}
          </Badge>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Engagement timeline</CardTitle>
            <CardDescription>
              Key milestones for this Risk Portfolio engagement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TimelineRow
                label="Profile delivered"
                value={engagement.assessment.profileEnteredAt}
              />
              <TimelineRow
                label="Recommendation accepted"
                value={engagement.acceptedAt}
              />
              <TimelineRow
                label="Meeting scheduled at"
                value={engagement.meetingScheduledAt}
              />
              <TimelineRow
                label="Meeting date"
                value={engagement.meetingAt}
              />
              <TimelineRow
                label="Completed"
                value={engagement.completedAt}
              />
              <TimelineRow
                label="Declined"
                value={engagement.declinedAt}
              />
            </dl>
            {engagement.notes ? (
              <div className="mt-6 space-y-1">
                <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Notes
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {engagement.notes}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Advance status</CardTitle>
            <CardDescription>
              Move this engagement through scheduling, execution, and
              completion. Only valid next states are shown for the current
              status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EngagementStatusForm
              engagementId={engagement.id}
              currentStatus={engagement.status}
              defaultMeetingAt={engagement.meetingAt}
              defaultNotes={engagement.notes ?? ""}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TimelineRow({
  label,
  value,
}: {
  label: string;
  value: Date | null;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm tabular-nums">
        {value ? format(value, "MMM d, yyyy") : "—"}
      </dd>
    </div>
  );
}
