import { auth } from '@/lib/auth';
import { listHouseholdMembers } from '@/lib/data/household-members';
import { getClientHouseholdProfilesEnabled } from '@/lib/household/profiles-policy';
import { Badge } from '@/components/ui/badge';
import { redirect } from 'next/navigation';
import { buildSignInHref } from '@/lib/auth/sign-in-routes';
import { ProfilesClient } from './ProfilesClient';
import { ProfilesDisabledNotice } from '@/components/profiles/ProfilesDisabledNotice';

export default async function ProfilesPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect(buildSignInHref({ callbackUrl: "/profiles" }));
  }

  const householdProfilesEnabled = await getClientHouseholdProfilesEnabled(session.user.id);

  if (!householdProfilesEnabled) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <ProfilesDisabledNotice />
      </div>
    );
  }

  const members = await listHouseholdMembers(session.user.id);
  const residentCount = members.filter((member) => member.isResident).length;
  const governanceAssignments = members.reduce(
    (total, member) => total + member.governanceRoles.length,
    0,
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="hero-surface overflow-hidden px-4 py-5 sm:px-8 sm:py-8">
        <div className="app-grid gap-5 sm:gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(22rem,0.85fr)]">
          <div className="space-y-4 sm:space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{members.length} household profiles</Badge>
              <Badge variant="secondary">{residentCount} living in household</Badge>
              <Badge variant="info">{governanceAssignments} governance assignments</Badge>
            </div>
          </div>

          <div className="hidden gap-4 sm:grid sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-[1.5rem] border border-border/70 bg-background/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
              <p className="editorial-kicker">Coverage</p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{members.length}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Profiles documented across immediate and extended family.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-border/70 bg-background/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
              <p className="editorial-kicker">Residents</p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{residentCount}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Household members actively living inside the primary household.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-border/70 bg-background/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
              <p className="editorial-kicker">Role Mapping</p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
                {governanceAssignments}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Governance roles assigned across decision-makers, advisors, and successors.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-2">
        <p className="editorial-kicker">Household Directory</p>
        <p className="max-w-2xl text-sm leading-5 text-muted-foreground sm:text-base sm:leading-6">
          Maintain core details, contact context, and governance responsibilities in one place.
        </p>
      </div>

      <ProfilesClient initialMembers={members} />
    </div>
  );
}
