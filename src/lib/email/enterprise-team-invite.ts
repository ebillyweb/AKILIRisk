import "server-only";

import { Resend } from "resend";

import { resolveFromEmail } from "@/lib/email/resolve-from-email";
import { formatEmailSubject } from "@/lib/email/format-email-subject";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export type SendEnterpriseTeamInviteEmailInput = {
  inviteeEmail: string;
  enterpriseName: string;
  inviterName: string;
  roleLabel: string;
  inviteUrl: string;
};

export async function sendEnterpriseTeamInviteEmail(
  input: SendEnterpriseTeamInviteEmailInput
): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    console.info("[enterprise-team] invite email skipped (RESEND_API_KEY missing)", {
      inviteeEmail: input.inviteeEmail,
      inviteUrl: input.inviteUrl,
    });
    return { success: true };
  }

  const subject = formatEmailSubject(`Join ${input.enterpriseName} on AkiliRisk`);
  const html = `
    <p>You have been invited to join <strong>${input.enterpriseName}</strong> as ${input.roleLabel}.</p>
    <p>${input.inviterName} sent this invitation.</p>
    <p><a href="${input.inviteUrl}">Accept invitation</a></p>
    <p>This link expires in 7 days.</p>
  `;

  try {
    await resend.emails.send({
      from: resolveFromEmail(),
      to: input.inviteeEmail,
      subject,
      html,
    });
    return { success: true };
  } catch (error) {
    console.error("[enterprise-team] failed to send invite email", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send invitation email",
    };
  }
}
