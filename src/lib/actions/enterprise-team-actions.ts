"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdvisorRole, getAdvisorProfileOrThrow } from "@/lib/advisor/auth";
import { sendEnterpriseTeamInviteEmail } from "@/lib/email/enterprise-team-invite";
import { resolveEnterpriseTeamContext } from "@/lib/enterprise/team-access";
import {
  EnterpriseTeamInviteError,
  acceptEnterpriseTeamInvite,
  inviteEnterpriseMember,
  reactivateEnterpriseMember,
  suspendEnterpriseMember,
} from "@/lib/enterprise/team-invite";

const inviteSchema = z.object({
  email: z.string().email().max(254),
  role: z.enum(["ADMIN", "ADVISOR"]),
});

const membershipIdSchema = z.object({
  membershipId: z.string().cuid(),
});

function actionError(error: unknown, fallback: string) {
  if (error instanceof EnterpriseTeamInviteError) return error.message;
  if (error instanceof z.ZodError) return "Invalid request";
  return error instanceof Error ? error.message : fallback;
}

export async function inviteEnterpriseTeamMemberAction(input: unknown) {
  try {
    const { userId } = await requireAdvisorRole();
    const [profile, team] = await Promise.all([
      getAdvisorProfileOrThrow(userId),
      resolveEnterpriseTeamContext(userId),
    ]);
    if (!team) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = inviteSchema.parse(input);
    const result = await inviteEnterpriseMember(userId, parsed);

    const inviterName =
      profile.user.name ||
      [profile.user.firstName, profile.user.lastName].filter(Boolean).join(" ") ||
      "Your firm administrator";

    await sendEnterpriseTeamInviteEmail({
      inviteeEmail: parsed.email.trim().toLowerCase(),
      enterpriseName: team.enterpriseName,
      inviterName,
      roleLabel: parsed.role === "ADMIN" ? "a firm administrator" : "an advisor",
      inviteUrl: result.inviteUrl,
    });

    revalidatePath("/advisor/settings/team");
    return { success: true as const, data: result };
  } catch (error) {
    return { success: false as const, error: actionError(error, "Failed to send team invitation") };
  }
}

export async function suspendEnterpriseTeamMemberAction(input: unknown) {
  try {
    const { userId } = await requireAdvisorRole();
    const { membershipId } = membershipIdSchema.parse(input);
    await suspendEnterpriseMember(userId, membershipId);
    revalidatePath("/advisor/settings/team");
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: actionError(error, "Failed to suspend team member") };
  }
}

export async function reactivateEnterpriseTeamMemberAction(input: unknown) {
  try {
    const { userId } = await requireAdvisorRole();
    const { membershipId } = membershipIdSchema.parse(input);
    await reactivateEnterpriseMember(userId, membershipId);
    revalidatePath("/advisor/settings/team");
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: actionError(error, "Failed to reactivate team member") };
  }
}

export async function acceptEnterpriseTeamInviteAction(token: string) {
  try {
    const { userId } = await requireAdvisorRole();
    const { verifyEnterpriseTeamInviteToken } = await import(
      "@/lib/enterprise/team-invite-token"
    );
    const membershipId = verifyEnterpriseTeamInviteToken(token.trim());
    if (!membershipId) {
      return { success: false as const, error: "This invitation link is invalid or has expired." };
    }

    const result = await acceptEnterpriseTeamInvite(membershipId, userId);
    revalidatePath("/advisor");
    return { success: true as const, data: result };
  } catch (error) {
    return { success: false as const, error: actionError(error, "Failed to accept invitation") };
  }
}
