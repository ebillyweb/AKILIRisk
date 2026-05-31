import "server-only";

import {
  resolveAdvisorEmailLogo,
  type AdvisorEmailLogoAttachment,
} from "@/lib/email/advisor-email-logo";
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
  console.info("[invitations] sending invitation email", {
    clientEmail: input.clientEmail.trim().toLowerCase(),
    brandingEnabled: input.theme.brandingEnabled,
  });

  const resolvedLogo =
    input.theme.showAdvisorLogo || input.profile.brandingEnabled
      ? await resolveAdvisorEmailLogo({
          logoS3Key: input.profile.logoS3Key,
          logoUrl: input.profile.logoUrl,
        })
      : null;

  const logoEmailSrc = resolvedLogo?.src;
  const logoAttachment: AdvisorEmailLogoAttachment | null =
    resolvedLogo?.attachment ?? null;

  if (input.theme.brandingEnabled) {
    return sendEnhancedAdvisorInvitationEmail({
      clientEmail: input.clientEmail,
      clientName: input.clientName,
      personalMessage: input.personalMessage,
      invitationUrl: input.invitationUrl,
      branding: {
        ...buildInvitationEmailBranding(input.profile, input.advisorInfo),
        logoEmailSrc,
      },
      logoAttachment,
    });
  }

  return sendAdvisorInvitationEmail({
    clientEmail: input.clientEmail,
    clientName: input.clientName,
    personalMessage: input.personalMessage,
    invitationUrl: input.invitationUrl,
    advisorInfo: input.advisorInfo,
    theme: {
      ...input.theme,
      logoEmailSrc,
    },
    logoAttachment,
  });
}
