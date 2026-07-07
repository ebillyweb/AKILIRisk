import "server-only";

import type { EnterpriseRole } from "@prisma/client";

import { findUserByEmail, userEmailWriteData } from "@/lib/auth/user-email";
import { decryptUserEmail } from "@/lib/auth/user-email-crypto";
import { prisma } from "@/lib/db";
import { cancelSoloSubscriptionForEnterprise } from "@/lib/enterprise/cancel-solo-subscription";
import { cancelStripeSubscriptionBestEffort } from "@/lib/billing/cancel-stripe-subscription";
import { transferAdvisorAssetsToEnterprise } from "@/lib/enterprise/transfer-advisor-assets";
import { syncEnterpriseRulesToMembers } from "@/lib/methodology/clone-enterprise-defaults";
import { syncEnterpriseMethodologyToMembers } from "@/lib/methodology/clone-enterprise-methodology";
import { provisionEnterpriseTeamMemberContent } from "@/lib/enterprise/provision-team-member-content";
import { getEnterpriseSeatUsage } from "@/lib/enterprise/seat-reporting";
import {
  buildEnterpriseTeamInviteUrl,
  createEnterpriseTeamInviteToken,
  verifyEnterpriseTeamInviteToken,
} from "@/lib/enterprise/team-invite-token";
import { requireEnterpriseTeamManager, resolveEnterpriseTeamContext } from "@/lib/enterprise/team-access";

export class EnterpriseTeamInviteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnterpriseTeamInviteError";
  }
}

export type InviteEnterpriseMemberInput = {
  email: string;
};

export type EnterpriseTeamMemberView = {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  role: EnterpriseRole;
  status: "INVITED" | "ACTIVE" | "SUSPENDED";
  invitedAt: string | null;
  acceptedAt: string | null;
};

export async function listEnterpriseTeamMembers(
  enterpriseId: string
): Promise<EnterpriseTeamMemberView[]> {
  const rows = await prisma.enterpriseMembership.findMany({
    where: { enterpriseId },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      userId: true,
      role: true,
      status: true,
      invitedAt: true,
      acceptedAt: true,
      user: {
        select: {
          name: true,
          emailCiphertext: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    email: decryptUserEmail(row.user.emailCiphertext),
    name: row.user.name,
    role: row.role,
    status: row.status,
    invitedAt: row.invitedAt?.toISOString() ?? null,
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
  }));
}

function resolveInviteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_URL?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new EnterpriseTeamInviteError("NEXT_PUBLIC_URL is not configured");
  }
  return "http://localhost:3000";
}

export async function inviteEnterpriseMember(
  inviterUserId: string,
  input: InviteEnterpriseMemberInput
): Promise<{ membershipId: string; status: "INVITED"; inviteUrl: string }> {
  const team = await requireEnterpriseTeamManager(inviterUserId);
  const normalizedEmail = input.email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new EnterpriseTeamInviteError("Email is required");
  }

  const existingByEmail = await findUserByEmail(normalizedEmail, {
    select: {
      id: true,
      role: true,
      deletedAt: true,
      enterpriseMembership: { select: { id: true, enterpriseId: true, status: true } },
      advisorProfile: { select: { id: true, enterpriseId: true } },
    },
  });

  if (existingByEmail?.deletedAt) {
    throw new EnterpriseTeamInviteError("That email belongs to a deactivated account.");
  }

  if (existingByEmail?.enterpriseMembership) {
    if (existingByEmail.enterpriseMembership.enterpriseId === team.enterpriseId) {
      throw new EnterpriseTeamInviteError("This person is already on your team.");
    }
    throw new EnterpriseTeamInviteError("This email is already linked to another firm.");
  }

  if (existingByEmail && existingByEmail.role !== "ADVISOR") {
    throw new EnterpriseTeamInviteError("This email cannot be invited as a team member.");
  }

  const inviteeUser =
    existingByEmail ??
    (await prisma.user.create({
      data: {
        ...userEmailWriteData(normalizedEmail),
        role: "ADVISOR",
        password: null,
        emailVerified: null,
      },
      select: { id: true },
    }));

  const membership = await prisma.enterpriseMembership.create({
    data: {
      enterpriseId: team.enterpriseId,
      userId: inviteeUser.id,
      advisorProfileId: existingByEmail?.advisorProfile?.id ?? null,
      role: "ADVISOR",
      status: "INVITED",
      invitedEmail: normalizedEmail,
      invitedAt: new Date(),
    },
  });

  const token = createEnterpriseTeamInviteToken(membership.id);
  const inviteUrl = buildEnterpriseTeamInviteUrl(resolveInviteOrigin(), token);

  return { membershipId: membership.id, status: "INVITED", inviteUrl };
}

export type ResolvedEnterpriseTeamInvite =
  | {
      ok: true;
      membershipId: string;
      enterpriseName: string;
      inviteeEmail: string;
      needsRegistration: boolean;
    }
  | { ok: false; error: string };

export async function resolveEnterpriseTeamInvite(
  token: string
): Promise<ResolvedEnterpriseTeamInvite> {
  const trimmed = token.trim();
  if (!trimmed) {
    return { ok: false, error: "This team invitation link is missing a token." };
  }

  const membershipId = verifyEnterpriseTeamInviteToken(trimmed);
  if (!membershipId) {
    return { ok: false, error: "This team invitation link is invalid or has expired." };
  }

  const membership = await prisma.enterpriseMembership.findUnique({
    where: { id: membershipId },
    select: {
      status: true,
      invitedEmail: true,
      user: {
        select: {
          password: true,
          emailCiphertext: true,
        },
      },
      enterprise: { select: { name: true } },
    },
  });

  if (!membership || membership.status !== "INVITED") {
    return { ok: false, error: "This team invitation is no longer valid." };
  }

  const inviteeEmail =
    membership.invitedEmail?.trim().toLowerCase() ??
    decryptUserEmail(membership.user.emailCiphertext);

  return {
    ok: true,
    membershipId,
    enterpriseName: membership.enterprise.name,
    inviteeEmail,
    needsRegistration: !membership.user.password,
  };
}

async function requirePendingInviteMembership(
  actorUserId: string,
  membershipId: string
): Promise<{
  enterpriseId: string;
  enterpriseName: string;
  membershipId: string;
  inviteeEmail: string;
}> {
  const team = await requireEnterpriseTeamManager(actorUserId);
  const membership = await prisma.enterpriseMembership.findFirst({
    where: { id: membershipId, enterpriseId: team.enterpriseId },
    select: {
      id: true,
      status: true,
      role: true,
      invitedEmail: true,
      user: { select: { emailCiphertext: true } },
      enterprise: { select: { name: true } },
    },
  });

  if (!membership) {
    throw new EnterpriseTeamInviteError("Team member not found.");
  }
  if (membership.status !== "INVITED") {
    throw new EnterpriseTeamInviteError("Only pending invitations can be resent or removed.");
  }
  if (membership.role === "OWNER") {
    throw new EnterpriseTeamInviteError("The firm owner cannot be removed.");
  }

  const inviteeEmail =
    membership.invitedEmail?.trim().toLowerCase() ??
    decryptUserEmail(membership.user.emailCiphertext);

  return {
    enterpriseId: team.enterpriseId,
    enterpriseName: membership.enterprise.name,
    membershipId: membership.id,
    inviteeEmail,
  };
}

export async function resendEnterpriseTeamInvite(
  actorUserId: string,
  membershipId: string
): Promise<{ inviteUrl: string; inviteeEmail: string }> {
  const pending = await requirePendingInviteMembership(actorUserId, membershipId);

  await prisma.enterpriseMembership.update({
    where: { id: pending.membershipId },
    data: { invitedAt: new Date() },
  });

  const token = createEnterpriseTeamInviteToken(pending.membershipId);
  const inviteUrl = buildEnterpriseTeamInviteUrl(resolveInviteOrigin(), token);

  return { inviteUrl, inviteeEmail: pending.inviteeEmail };
}

export async function revokeEnterpriseTeamInvite(
  actorUserId: string,
  membershipId: string
): Promise<void> {
  const pending = await requirePendingInviteMembership(actorUserId, membershipId);
  await prisma.enterpriseMembership.delete({ where: { id: pending.membershipId } });
}

export async function acceptEnterpriseTeamInvite(
  membershipId: string,
  acceptingUserId: string
): Promise<{ enterpriseId: string; enterpriseName: string }> {
  const membership = await prisma.enterpriseMembership.findUnique({
    where: { id: membershipId },
    include: {
      enterprise: { select: { id: true, name: true } },
      user: { select: { id: true, emailCiphertext: true } },
    },
  });

  if (!membership || membership.status !== "INVITED") {
    throw new EnterpriseTeamInviteError("This team invitation is no longer valid.");
  }

  if (membership.userId !== acceptingUserId) {
    throw new EnterpriseTeamInviteError(
      "Sign in with the email address that received this invitation."
    );
  }

  let soloStripeSubscriptionId: string | null = null;
  let acceptedAdvisorProfileId: string | null = null;

  await prisma.$transaction(async (tx) => {
    const soloCancel = await cancelSoloSubscriptionForEnterprise(
      acceptingUserId,
      {
        reason: "enterprise_team_join",
        enterpriseId: membership.enterpriseId,
      },
      tx
    );
    soloStripeSubscriptionId = soloCancel.stripeSubscriptionId;

    let profile = await tx.advisorProfile.findUnique({
      where: { userId: acceptingUserId },
      select: { id: true, enterpriseId: true },
    });

    if (!profile) {
      profile = await tx.advisorProfile.create({
        data: {
          userId: acceptingUserId,
          enterpriseId: membership.enterpriseId,
          firmName: membership.enterprise.name,
        },
        select: { id: true, enterpriseId: true },
      });
    } else if (profile.enterpriseId && profile.enterpriseId !== membership.enterpriseId) {
      throw new EnterpriseTeamInviteError("Your advisor profile is already linked to another firm.");
    } else {
      await tx.advisorProfile.update({
        where: { id: profile.id },
        data: { enterpriseId: membership.enterpriseId },
      });
    }

    await tx.enterpriseMembership.update({
      where: { id: membershipId },
      data: {
        status: "ACTIVE",
        advisorProfileId: profile.id,
        acceptedAt: new Date(),
      },
    });

    acceptedAdvisorProfileId = profile.id;

    if (membership.role === "ADMIN") {
      await transferAdvisorAssetsToEnterprise(
        tx,
        profile.id,
        membership.enterpriseId,
      );
    }
  });

  await cancelStripeSubscriptionBestEffort(soloStripeSubscriptionId);

  if (acceptedAdvisorProfileId) {
    await provisionEnterpriseTeamMemberContent(
      membership.enterpriseId,
      acceptedAdvisorProfileId,
    );
  } else {
    await syncEnterpriseRulesToMembers(membership.enterpriseId);
    await syncEnterpriseMethodologyToMembers(membership.enterpriseId);
  }

  return {
    enterpriseId: membership.enterprise.id,
    enterpriseName: membership.enterprise.name,
  };
}

export async function suspendEnterpriseMember(
  actorUserId: string,
  membershipId: string
): Promise<void> {
  const team = await requireEnterpriseTeamManager(actorUserId);
  const membership = await prisma.enterpriseMembership.findFirst({
    where: { id: membershipId, enterpriseId: team.enterpriseId },
    select: { id: true, role: true, status: true },
  });
  if (!membership) {
    throw new EnterpriseTeamInviteError("Team member not found.");
  }
  if (membership.role === "OWNER") {
    throw new EnterpriseTeamInviteError("The firm owner cannot be suspended.");
  }
  if (membership.status === "SUSPENDED") return;

  await prisma.enterpriseMembership.update({
    where: { id: membershipId },
    data: { status: "SUSPENDED" },
  });
}

export async function reactivateEnterpriseMember(
  actorUserId: string,
  membershipId: string
): Promise<void> {
  const team = await requireEnterpriseTeamManager(actorUserId);
  const membership = await prisma.enterpriseMembership.findFirst({
    where: { id: membershipId, enterpriseId: team.enterpriseId },
    select: { id: true, status: true },
  });
  if (!membership) {
    throw new EnterpriseTeamInviteError("Team member not found.");
  }
  if (membership.status !== "SUSPENDED") return;

  await prisma.enterpriseMembership.update({
    where: { id: membershipId },
    data: { status: "ACTIVE" },
  });
}

export async function getEnterpriseTeamPageData(userId: string) {
  const team = await resolveEnterpriseTeamContext(userId);
  if (!team) return null;

  const [members, seatUsage] = await Promise.all([
    listEnterpriseTeamMembers(team.enterpriseId),
    getEnterpriseSeatUsage(team.enterpriseId),
  ]);

  return {
    ...team,
    members,
    seatUsage,
  };
}
