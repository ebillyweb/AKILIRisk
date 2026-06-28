import Link from "next/link";
import { format } from "date-fns";
import { Mail, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AdvisorGovernanceLead } from "@/lib/advisor/governance-lead-queries";
import { formatFamilyComplexity } from "@/lib/governance/family-complexity";
import { formatInvestableAssetsRange } from "@/lib/governance/investable-assets-range";

type AssessmentLeadDetailPanelProps = {
  lead: AdvisorGovernanceLead;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm leading-relaxed text-foreground">{value}</p>
    </div>
  );
}

export function AssessmentLeadDetailPanel({ lead }: AssessmentLeadDetailPanelProps) {
  const assignedAt = lead.assignedAt ?? lead.createdAt;
  const mailtoHref = `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(
    "Your AKILI risk assessment request"
  )}`;

  return (
    <div className="space-y-6">
      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">{lead.name}</CardTitle>
          <CardDescription>
            Assigned {format(assignedAt, "MMM d, yyyy 'at' h:mm a")} · Requested{" "}
            {format(lead.createdAt, "MMM d, yyyy")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <DetailRow label="Email" value={lead.email} />
            <DetailRow
              label="Family complexity"
              value={formatFamilyComplexity(lead.familyComplexity)}
            />
            <DetailRow
              label="Investable assets"
              value={
                lead.investableAssetsRange
                  ? formatInvestableAssetsRange(lead.investableAssetsRange)
                  : "Not provided"
              }
            />
          </div>

          {lead.promptedInterest ? (
            <DetailRow label="What prompted their interest" value={lead.promptedInterest} />
          ) : null}

          <div className="flex flex-wrap gap-3 border-t border-border/60 pt-5">
            <Button asChild>
              <a href={mailtoHref} className="inline-flex items-center gap-2">
                <Mail className="h-4 w-4" aria-hidden />
                Email {lead.name.split(" ")[0] || "prospect"}
              </a>
            </Button>
            <Button asChild variant="outline">
              <Link href="/advisor/invitations" className="inline-flex items-center gap-2">
                <UserPlus className="h-4 w-4" aria-hidden />
                Invite to AKILI
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-sm leading-relaxed text-muted-foreground">
        This person submitted the public assessment request form. They do not yet have an AKILI
        account. Follow up directly, then send an invitation when you are ready to begin intake.
      </p>
    </div>
  );
}
