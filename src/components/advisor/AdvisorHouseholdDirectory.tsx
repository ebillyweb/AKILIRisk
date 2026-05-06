import { UserRound, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { AdvisorHouseholdMemberView } from "@/lib/profiles/advisor-household-view";
import { GOVERNANCE_ROLE_LABELS, RELATIONSHIP_LABELS } from "@/lib/schemas/profile";

const SEX_LABELS: Partial<Record<NonNullable<AdvisorHouseholdMemberView["sex"]>, string>> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
  PREFER_NOT_TO_SAY: "Prefer not to say",
};

function MemberCard({ member }: { member: AdvisorHouseholdMemberView }) {
  const year = new Date().getUTCFullYear();
  const approxAge =
    typeof member.birthYear === "number" ? Math.max(0, year - member.birthYear) : null;

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-background/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="text-lg font-semibold text-foreground">{member.displayLabel}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-background/75 text-xs">
              {RELATIONSHIP_LABELS[member.relationship]}
            </Badge>
            <Badge variant={member.isResident ? "secondary" : "info"} className="text-xs">
              {member.isResident ? "Lives in household" : "Extended family"}
            </Badge>
          </div>
        </div>
      </div>

      {(approxAge !== null || member.sex || typeof member.birthYear === "number") && (
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          {typeof member.birthYear === "number" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-2.5 py-1">
              <UserRound className="size-3.5 shrink-0" />
              <span className="font-medium text-foreground">Born {member.birthYear}</span>
            </span>
          ) : null}
          {approxAge !== null ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-2.5 py-1">
              <span className="font-medium text-foreground">~{approxAge}</span>
              <span>years</span>
            </span>
          ) : null}
          {member.sex ? (
            <Badge variant="outline" className="text-xs">
              {SEX_LABELS[member.sex] ?? member.sex}
            </Badge>
          ) : null}
        </div>
      )}

      {member.governanceRoles.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Governance roles</p>
          <div className="flex flex-wrap gap-1.5">
            {member.governanceRoles.map((role) => (
              <Badge key={role} variant="secondary" className="text-xs">
                {GOVERNANCE_ROLE_LABELS[role]}
              </Badge>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No governance roles assigned.</p>
      )}
    </div>
  );
}

function DirectoryBody({ members }: { members: AdvisorHouseholdMemberView[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {members.map((member) => (
        <MemberCard key={member.id} member={member} />
      ))}
    </div>
  );
}

interface AdvisorHouseholdDirectoryProps {
  members: AdvisorHouseholdMemberView[];
}

/**
 * Mobile: collapsible &lt;details&gt;. Desktop (lg+): always expanded in a card.
 * Anchor id for sidebar link: #household-directory
 */
export function AdvisorHouseholdDirectory({ members }: AdvisorHouseholdDirectoryProps) {
  if (members.length === 0) {
    return (
      <div
        id="household-directory"
        className="scroll-mt-28 rounded-lg border border-dashed border-border/80 bg-muted/20 p-5 text-sm text-muted-foreground"
      >
        <p className="font-medium text-foreground">Household directory</p>
        <p className="mt-1">This client has not added household profiles yet.</p>
      </div>
    );
  }

  const hint =
    "Structural household data only (labels like Member A, relationship, residency, roles, birth year, sex). Personal names and contact are not collected.";

  return (
    <div id="household-directory" className="scroll-mt-28 space-y-0">
      <details className="group rounded-lg border border-border/70 bg-card shadow-sm lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-3.5 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-2">
            <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">Household directory</span>
            <Badge variant="secondary" className="shrink-0 text-xs">
              {members.length}
            </Badge>
          </span>
          <span className="shrink-0 text-xs font-normal text-muted-foreground">Tap to expand</span>
        </summary>
        <div className="border-t border-border/60 p-4 pt-4">
          <p className="mb-4 text-xs leading-relaxed text-muted-foreground">{hint}</p>
          <DirectoryBody members={members} />
        </div>
      </details>

      <div className="hidden space-y-4 rounded-lg border border-border/70 bg-card p-6 shadow-sm lg:block">
        <div className="flex flex-wrap items-center gap-2">
          <Users className="size-5 text-muted-foreground" aria-hidden />
          <h3 className="text-lg font-semibold tracking-tight">Household directory</h3>
          <Badge variant="outline">{members.length}</Badge>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{hint}</p>
        <DirectoryBody members={members} />
      </div>
    </div>
  );
}
