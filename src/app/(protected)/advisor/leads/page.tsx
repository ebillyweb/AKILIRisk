import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AssessmentLeadsList } from "@/components/advisor/leads/AssessmentLeadsList";
import {
  countUnreadLeadNotificationsForAdvisor,
  getAssignedGovernanceLeadsForAdvisor,
} from "@/lib/advisor/governance-lead-queries";
import { prisma } from "@/lib/db";
import { getAdvisorProfileOrThrow, requireAdvisorRole } from "@/lib/advisor/auth";

export default async function AdvisorLeadsPage() {
  const [{ userId }, leads] = await Promise.all([
    requireAdvisorRole(),
    getAssignedGovernanceLeadsForAdvisor(),
  ]);
  const profile = await getAdvisorProfileOrThrow(userId);

  const [unreadCount, unreadNotifications] = await Promise.all([
    countUnreadLeadNotificationsForAdvisor(),
    prisma.advisorNotification.findMany({
      where: {
        advisorId: profile.id,
        type: "NEW_LEAD",
        read: false,
        referenceId: { not: null },
      },
      select: { referenceId: true },
    }),
  ]);

  const unreadLeadIds = new Set(
    unreadNotifications
      .map((notification) => notification.referenceId)
      .filter((referenceId): referenceId is string => Boolean(referenceId))
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="space-y-1">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Clients</p>
        <h1 className="text-3xl font-semibold">Assessment leads</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Prospects who requested a risk assessment and were assigned to you by the AKILI team.
          Follow up directly, then invite them into AKILI when you are ready to begin.
        </p>
      </header>

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">
            Inbox{leads.length > 0 ? ` (${leads.length})` : ""}
          </CardTitle>
          <CardDescription>
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
              : leads.length > 0
                ? "Most recently assigned leads appear first."
                : "New assignments will appear here."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AssessmentLeadsList leads={leads} unreadLeadIds={unreadLeadIds} />
        </CardContent>
      </Card>
    </div>
  );
}
