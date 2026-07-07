import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AdvisorGovernanceLead } from "@/lib/advisor/governance-lead-queries";
import { formatFamilyComplexity } from "@/lib/governance/family-complexity";
import { formatInvestableAssetsRange } from "@/lib/governance/investable-assets-range";

type AssessmentLeadsListProps = {
  leads: AdvisorGovernanceLead[];
  unreadLeadIds?: Set<string>;
};

export function AssessmentLeadsList({
  leads,
  unreadLeadIds = new Set(),
}: AssessmentLeadsListProps) {
  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 py-14 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Inbox className="h-7 w-7 text-muted-foreground" aria-hidden />
        </div>
        <p className="mt-5 text-sm font-medium text-foreground">No leads assigned yet</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          When someone requests a risk assessment through AKILI, platform staff assign the
          lead to you here. You&apos;ll also get a notification when a new lead arrives.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border" role="list">
      {leads.map((lead) => {
        const isUnread = unreadLeadIds.has(lead.id);
        const assignedAt = lead.assignedAt ?? lead.createdAt;

        return (
          <li key={lead.id}>
            <Link
              href={`/advisor/leads/${lead.id}`}
              className="group flex flex-col gap-3 py-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-start sm:justify-between sm:px-3 sm:first:pt-3"
            >
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className={
                      isUnread
                        ? "text-sm font-semibold text-foreground"
                        : "text-sm font-medium text-foreground"
                    }
                  >
                    {lead.name}
                  </p>
                  {isUnread ? (
                    <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px]">
                      New
                    </Badge>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">{lead.email}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>Complexity: {formatFamilyComplexity(lead.familyComplexity)}</span>
                  {lead.investableAssetsRange ? (
                    <span>
                      Assets: {formatInvestableAssetsRange(lead.investableAssetsRange)}
                    </span>
                  ) : null}
                </div>
                {lead.promptedInterest ? (
                  <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2">
                    {lead.promptedInterest}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground sm:flex-col sm:items-end sm:pt-0.5">
                <time dateTime={assignedAt.toISOString()}>
                  Assigned {formatDistanceToNow(assignedAt, { addSuffix: true })}
                </time>
                <ArrowRight
                  className="hidden h-4 w-4 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5 sm:block"
                  aria-hidden
                />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
