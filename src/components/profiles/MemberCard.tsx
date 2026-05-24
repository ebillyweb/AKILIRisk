'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { HouseholdMember } from '@prisma/client';
import { RELATIONSHIP_LABELS, GOVERNANCE_ROLE_LABELS } from '@/lib/schemas/profile';
import { Pencil, ShieldCheck, Trash2, UserRound } from 'lucide-react';

const SEX_LABELS: Partial<Record<NonNullable<HouseholdMember['sex']>, string>> = {
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
  PREFER_NOT_TO_SAY: 'Prefer not to say',
};

interface MemberCardProps {
  member: HouseholdMember;
  onEdit: (member: HouseholdMember) => void;
  onDelete: (id: string) => void;
}

export function MemberCard({ member, onEdit, onDelete }: MemberCardProps) {
  const handleDelete = () => {
    if (window.confirm(`Delete ${member.displayLabel}?`)) {
      onDelete(member.id);
    }
  };

  const currentYear = new Date().getUTCFullYear();
  const derivedAge =
    typeof member.birthYear === 'number' ? Math.max(0, currentYear - member.birthYear) : null;

  return (
    <Card className="group flex h-full flex-col overflow-hidden transition-transform duration-200 hover:-translate-y-1">
      <CardHeader className="space-y-4 border-b section-divider pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="editorial-kicker">Household profile</p>
              <CardTitle className="text-xl sm:text-2xl">{member.displayLabel}</CardTitle>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-background/75">
                {RELATIONSHIP_LABELS[member.relationship]}
              </Badge>
              <Badge variant={member.isResident ? 'secondary' : 'info'} className="bg-background/75">
                {member.isResident ? 'Lives in household' : 'Extended family'}
              </Badge>
              {member.shareWithAdvisor === false ? (
                <Badge variant="outline" className="bg-background/75">
                  Hidden from advisor
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => onEdit(member)}
              className="shrink-0 bg-background/80"
              aria-label={`Edit ${member.displayLabel}`}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleDelete}
              className="shrink-0 text-destructive hover:text-destructive"
              aria-label={`Delete ${member.displayLabel}`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>

        {(derivedAge !== null || member.sex || member.birthYear) && (
          <div className="flex flex-wrap gap-2">
            {typeof member.birthYear === 'number' ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-sm text-muted-foreground">
                <UserRound className="size-3.5" />
                <span className="font-medium text-foreground">Born {member.birthYear}</span>
              </div>
            ) : null}
            {derivedAge !== null ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-sm text-muted-foreground">
                <UserRound className="size-3.5" />
                <span className="font-medium text-foreground">~{derivedAge}</span>
                <span>years old</span>
              </div>
            ) : null}
            {member.sex ? (
              <Badge variant="outline" className="bg-background/75">
                {SEX_LABELS[member.sex] ?? member.sex}
              </Badge>
            ) : null}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4 pt-5">
        {member.governanceRoles.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <ShieldCheck className="size-3.5" />
              Governance roles
            </div>
            <div className="flex flex-wrap gap-2">
              {member.governanceRoles.map((role) => (
                <Badge key={role} variant="secondary" className="text-xs">
                  {GOVERNANCE_ROLE_LABELS[role]}
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-[1.25rem] border border-dashed border-border/80 bg-background/55 p-4 text-sm text-muted-foreground">
            No governance roles have been assigned yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
