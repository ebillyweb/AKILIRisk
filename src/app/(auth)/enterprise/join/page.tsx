import { redirect } from "next/navigation";

import { InviteAcceptFailure } from "@/components/auth/InviteAcceptFailure";
import { acceptEnterpriseTeamInviteAction } from "@/lib/actions/enterprise-team-actions";
import { auth } from "@/lib/auth";
import { verifyEnterpriseTeamInviteToken } from "@/lib/enterprise/team-invite-token";
import { prisma } from "@/lib/db";

export default async function EnterpriseJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const token = sp.token?.trim();
  if (!token) {
    return (
      <InviteAcceptFailure message="This team invitation link is missing a token." />
    );
  }

  const membershipId = verifyEnterpriseTeamInviteToken(token);
  if (!membershipId) {
    return (
      <InviteAcceptFailure message="This team invitation link is invalid or has expired." />
    );
  }

  const membership = await prisma.enterpriseMembership.findUnique({
    where: { id: membershipId },
    select: {
      status: true,
      invitedEmail: true,
      enterprise: { select: { name: true } },
    },
  });

  if (!membership || membership.status !== "INVITED") {
    return (
      <InviteAcceptFailure message="This team invitation is no longer valid." />
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(`/enterprise/join?token=${encodeURIComponent(token)}`)}`);
  }

  if (session.user.role !== "ADVISOR") {
    return (
      <InviteAcceptFailure message="Team invitations require an advisor account." />
    );
  }

  const result = await acceptEnterpriseTeamInviteAction(token);
  if (!result.success) {
    return <InviteAcceptFailure message={result.error} />;
  }

  redirect("/advisor?notice=enterprise_joined");
}
