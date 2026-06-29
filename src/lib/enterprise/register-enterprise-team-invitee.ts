import "server-only";

import { z } from "zod";

import { validatePasswordForSet } from "@/lib/auth/password-policy";
import { hashPasswordForStorage } from "@/lib/auth/password-update";
import { prisma } from "@/lib/db";
import { getPasswordPolicy } from "@/lib/platform/password-policy-settings";
import {
  EnterpriseTeamInviteError,
  resolveEnterpriseTeamInvite,
} from "@/lib/enterprise/team-invite";

export const enterpriseTeamInviteSignupSchema = z
  .object({
    token: z.string().min(1, "Invitation token is required"),
    name: z.string().min(1, "Name is required").max(200),
    password: z.string().min(1, "Password is required"),
    confirmPassword: z.string().min(1, "Confirm your password"),
    acceptTerms: z.literal(true, {
      message: "You must accept the terms to continue",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type EnterpriseTeamInviteSignupInput = z.infer<
  typeof enterpriseTeamInviteSignupSchema
>;

export type RegisterEnterpriseTeamInviteeResult =
  | { success: true; email: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function registerEnterpriseTeamInvitee(
  input: unknown
): Promise<RegisterEnterpriseTeamInviteeResult> {
  const parsed = enterpriseTeamInviteSignupSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const message =
      Object.values(fieldErrors).flat().join("; ") || "Validation failed";
    return { success: false, error: message, fieldErrors };
  }

  const data = parsed.data;
  const invite = await resolveEnterpriseTeamInvite(data.token);
  if (!invite.ok) {
    return { success: false, error: invite.error };
  }
  if (!invite.needsRegistration) {
    return {
      success: false,
      error: "This invitation already has an account. Sign in to continue.",
    };
  }

  const policy = await getPasswordPolicy();
  const passwordPolicy = await validatePasswordForSet(data.password, policy);
  if (!passwordPolicy.ok) {
    return {
      success: false,
      error: passwordPolicy.error,
      fieldErrors: { password: [passwordPolicy.error] },
    };
  }

  const membership = await prisma.enterpriseMembership.findUnique({
    where: { id: invite.membershipId },
    select: {
      status: true,
      userId: true,
      enterpriseId: true,
      enterprise: { select: { name: true } },
    },
  });

  if (!membership || membership.status !== "INVITED") {
    return { success: false, error: "This team invitation is no longer valid." };
  }

  const hashedPassword = await hashPasswordForStorage(data.password);
  const displayName = data.name.trim();
  const firmName = membership.enterprise.name.trim();

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: membership.userId },
        select: { id: true, password: true, advisorProfile: { select: { id: true, enterpriseId: true } } },
      });

      if (!user) {
        throw new EnterpriseTeamInviteError("This team invitation is no longer valid.");
      }
      if (user.password) {
        throw new EnterpriseTeamInviteError(
          "This invitation already has an account. Sign in to continue."
        );
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordChangeRequired: false,
          passwordPolicyRevision: policy.revision,
          emailVerified: new Date(),
          name: displayName,
        },
      });

      if (!user.advisorProfile) {
        const profile = await tx.advisorProfile.create({
          data: {
            userId: user.id,
            enterpriseId: membership.enterpriseId,
            firmName,
            brandName: firmName,
          },
          select: { id: true },
        });

        await tx.enterpriseMembership.update({
          where: { id: invite.membershipId },
          data: { advisorProfileId: profile.id },
        });
      } else if (!user.advisorProfile.enterpriseId) {
        await tx.advisorProfile.update({
          where: { id: user.advisorProfile.id },
          data: { enterpriseId: membership.enterpriseId },
        });
        await tx.enterpriseMembership.update({
          where: { id: invite.membershipId },
          data: { advisorProfileId: user.advisorProfile.id },
        });
      }
    });
  } catch (error) {
    if (error instanceof EnterpriseTeamInviteError) {
      return { success: false, error: error.message };
    }
    throw error;
  }

  return { success: true, email: invite.inviteeEmail };
}
