import "server-only";

import { sendAdvisorInvitationEmail, type SendEmailResult } from "@/lib/invitations/email";
import { sendEnhancedAdvisorInvitationEmail } from "@/lib/invitations/enhanced-email";
import {
  buildInvitationEmailBranding,
  type InvitationAdvisorContact,
  type InvitationAdvisorProfile,
} from "@/lib/invitations/invitation-email-branding";
import type { InvitationEmailTheme } from "@/lib/invitations/invitation-email-theme";

export type SendInvitationEmailInput = {
  clientEmail: string;
  clientName?: string;
  personalMessage: string;
  invitationUrl: string;
  profile: InvitationAdvisorProfile;
  advisorInfo: InvitationAdvisorContact;
  theme: InvitationEmailTheme;
};

/**
 * Sends an invitation email using the enhanced template (tagline header) when
 * branding is enabled, otherwise the platform-neutral template.
 */
export async function sendInvitationEmail(
  input: SendInvitationEmailInput
): Promise<SendEmailResult> {
  if (input.theme.brandingEnabled) {
    return sendEnhancedAdvisorInvitationEmail({
      clientEmail: input.clientEmail,
      clientName: input.clientName,
      personalMessage: input.personalMessage,
      invitationUrl: input.invitationUrl,
      branding: buildInvitationEmailBranding(input.profile, input.advisorInfo),
    });
  }

  return sendAdvisorInvitationEmail({
    clientEmail: input.clientEmail,
    clientName: input.clientName,
    personalMessage: input.personalMessage,
    invitationUrl: input.invitationUrl,
    advisorInfo: input.advisorInfo,
    theme: input.theme,
  });
}
