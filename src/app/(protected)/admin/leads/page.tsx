import {
  getAdvisorProfilesForLeadAssignment,
  getGovernanceReviewLeadsForAdmin,
} from "@/lib/admin/queries";
import { GovernanceLeadAssignSelect } from "@/components/admin/GovernanceLeadAssignSelect";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function advisorOptionLabel(a: {
  firmName: string | null;
  user: { email: string | null; name: string | null };
}) {
  const email = a.user.email ?? "No email";
  const parts = [a.firmName, a.user.name].filter(Boolean) as string[];
  if (parts.length === 0) return email;
  return `${parts.join(" · ")} (${email})`;
}

function formatComplexity(c: string) {
  return c.replace(/_/g, " ").toLowerCase();
}

export default async function AdminGovernanceLeadsPage() {
  const [leads, advisors] = await Promise.all([
    getGovernanceReviewLeadsForAdmin(),
    getAdvisorProfilesForLeadAssignment(),
  ]);

  const advisorOptions = advisors.map((a) => ({
    id: a.id,
    label: advisorOptionLabel(a),
  }));

  const unassignedCount = leads.filter((l) => !l.assignedAdvisorId).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assessment requests ({leads.length})</CardTitle>
          {leads.length > 0 ? (
            <CardDescription>
              {unassignedCount > 0
                ? `${unassignedCount} unassigned — assign each row to an advisor when ready.`
                : "All current requests have an advisor assigned."}
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <p className="text-sm text-muted-foreground">No requests yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {leads.map((lead) => (
                <li
                  key={lead.id}
                  className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 lg:flex-row lg:items-start lg:justify-between"
                >
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{lead.name}</p>
                      {!lead.assignedAdvisorId ? (
                        <Badge variant="outline">Unassigned</Badge>
                      ) : (
                        <Badge variant="secondary">Assigned</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{lead.email}</p>
                    <p className="text-sm text-muted-foreground">
                      Household: {lead.familyOfficeName}
                    </p>
                    {lead.primaryAdvisor ? (
                      <p className="text-sm text-muted-foreground">
                        Named advisor (optional): {lead.primaryAdvisor}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      Complexity: {formatComplexity(lead.familyComplexity)}
                    </p>
                    {lead.promptedInterest ? (
                      <p className="text-sm leading-6 text-muted-foreground">
                        Note: {lead.promptedInterest}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      Submitted {lead.createdAt.toLocaleString()}
                    </p>
                  </div>
                  <div className="shrink-0 space-y-2 lg:pt-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Assign to advisor
                    </p>
                    <GovernanceLeadAssignSelect
                      leadId={lead.id}
                      assignedAdvisorId={lead.assignedAdvisorId}
                      advisors={advisorOptions}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
