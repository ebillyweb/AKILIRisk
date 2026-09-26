import { clientPortalBrandingDisplayTitle } from "@/lib/client/client-portal-branding";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

export type InvitationAdvisorProfile = {
  firmName: string | null;
  brandName: string | null;
  tagline: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  logoUrl: string | null;
  logoS3Key: string | null;
  websiteUrl: string | null;
  emailFooterText: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  /** Custom "from" email address for white-label client emails. */
  clientEmailFromAddress: string | null;
  brandingEnabled: boolean;
};

export type InvitationAdvisorContact = {
  advisorName: string;
  advisorJobTitle: string;
  advisorFirmName: string;
  advisorEmail: string;
  advisorPhone: string;
  advisorLicenseNumber: string;
};

/** Client-facing firm label for invitation form + email copy. */
export function invitationFirmDisplayName(
  profile: Pick<InvitationAdvisorProfile, "firmName" | "brandName">,
  branding?: Pick<AdvisorBrandingData, "brandName" | "advisorFirmName"> | null,
): string | null {
  if (branding) {
    const title = clientPortalBrandingDisplayTitle({
      ...branding,
      brandingEnabled: true,
    } as AdvisorBrandingData);
    return title === "Partner portal" ? null : title;
  }
  return profile.firmName?.trim() || profile.brandName?.trim() || null;
}

export function buildInvitationEmailBranding(
  profile: InvitationAdvisorProfile,
  contact: InvitationAdvisorContact
): AdvisorBrandingData & InvitationAdvisorContact {
  const firm =
    profile.brandName?.trim() ||
    profile.firmName?.trim() ||
    contact.advisorFirmName;
  return {
    brandName: profile.brandName?.trim() || firm,
    advisorFirmName: firm,
    tagline: profile.tagline,
    primaryColor: profile.primaryColor,
    secondaryColor: profile.secondaryColor,
    accentColor: profile.accentColor,
    logoUrl: profile.logoUrl,
    logoS3Key: profile.logoS3Key,
    websiteUrl: profile.websiteUrl,
    emailFooterText: profile.emailFooterText,
    supportEmail: profile.supportEmail || contact.advisorEmail,
    supportPhone: profile.supportPhone || contact.advisorPhone,
    clientEmailFromAddress: profile.clientEmailFromAddress,
    brandingEnabled: profile.brandingEnabled,
    customDomainEnabled: false,
    advisorName: contact.advisorName,
    advisorJobTitle: contact.advisorJobTitle,
    advisorEmail: contact.advisorEmail,
    advisorPhone: contact.advisorPhone,
    advisorLicenseNumber: contact.advisorLicenseNumber,
  };
}
