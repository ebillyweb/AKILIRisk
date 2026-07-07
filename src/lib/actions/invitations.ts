"use server";

import type { UserRole } from "@prisma/client";
import { requireAdvisorRole, getAdvisorProfileOrThrow, advisorHubActionErrorMessage } from "@/lib/advisor/auth";
import { getAdvisorClientDataPolicyContext } from "@/lib/enterprise/enterprise-client-data-policy";
import {
  assertCanAddClientForAdvisorProfile,
  ClientLimitError,
} from "@/lib/billing/subscription-service";
import {
  createAdvisorInvitation,
  DuplicateInvitationError,
  expireInvitation,
  getAdvisorInvitations,
  resendInvitation,
} from "@/lib/invitations/service";
import { resolveInvitationEmailTheme } from "@/lib/invitations/invitation-email-theme";
import { sendInvitationEmail } from "@/lib/invitations/send-invitation-email";
import {
  getSubscriptionFeatures,
  ESSENTIALS_SUBSCRIPTION_FEATURES,
} from "@/lib/subscription/validation";
import {
  createInvitationSchema,
  buildDefaultInvitationPersonalMessage,
} from "@/lib/schemas/invitation";
import { InvitationListFilters, InvitationListResult, InvitationWithDetails } from "@/lib/invitations/types";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import { assertAdvisorCanSkipIntake } from "@/lib/enterprise/advisor-member-visibility";
import {
  mapResolvedBrandingToInvitationProfile,
  resolveAdvisorBrandingForProfile,
} from "@/lib/enterprise/branding";
import type { InvitationAdvisorProfile } from "@/lib/invitations/invitation-email-branding";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function parseStringArrayField(raw: FormDataEntryValue | null): string[] | undefined {
  if (raw == null) return undefined;
  const text = String(raw).trim();
  if (!text) return undefined;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) return undefined;
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return undefined;
  }
}

function invitationEmailThemeForProfile(
  profile: {
    brandingEnabled: boolean;
    logoUrl: string | null;
    logoS3Key: string | null;
    primaryColor: string | null;
    userId: string;
  },
  features: { advancedBrandingEnabled: boolean }
) {
  return resolveInvitationEmailTheme({
    brandingEnabled: profile.brandingEnabled,
    advancedBrandingEnabled: features.advancedBrandingEnabled,
    logoUrl: profile.logoUrl,
    logoS3Key: profile.logoS3Key,
    primaryColor: profile.primaryColor,
  });
}

async function resolveInvitationBrandingForAdvisor(
  advisorProfileId: string,
  fallbackFirmName: string | null,
): Promise<InvitationAdvisorProfile> {
  const resolved = await resolveAdvisorBrandingForProfile(advisorProfileId, {
    scope: "client",
  });
  if (!resolved) {
    return {
      firmName: fallbackFirmName,
      brandName: fallbackFirmName,
      tagline: null,
      primaryColor: null,
      secondaryColor: null,
      accentColor: null,
      logoUrl: null,
      logoS3Key: null,
      websiteUrl: null,
      emailFooterText: null,
      supportEmail: null,
      supportPhone: null,
      brandingEnabled: false,
    };
  }
  return mapResolvedBrandingToInvitationProfile(resolved, fallbackFirmName);
}

/**
 * Server action to send a new invitation
 */
export async function sendInvitation(formData: FormData): Promise<ActionResult<InvitationWithDetails & { url: string; emailSent: boolean; emailNotSentReason?: string }>> {
  try {
    // Authenticate and get advisor role
    const { userId, role, email: actorEmail } = await requireAdvisorRole();

    // Get advisor profile with user info
    const profile = await getAdvisorProfileOrThrow(userId);

    // Parse and validate form data
    const rawData = {
      clientEmail: formData.get("clientEmail")?.toString() || "",
      clientName: formData.get("clientName")?.toString() || undefined,
      personalMessage: (() => {
        const raw = formData.get("personalMessage")?.toString();
        if (raw === undefined || raw === null) return undefined;
        const trimmed = raw.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      })(),
      intakeWaived: (() => {
        const v = formData.get("intakeWaived");
        if (v === null) return false;
        const s = String(v).toLowerCase();
        return s === "true" || s === "on" || s === "1";
      })(),
      includedPillars: parseStringArrayField(formData.get("includedPillars")),
      focusAreas: parseStringArrayField(formData.get("focusAreas")),
    };

    const validatedInput = createInvitationSchema.parse(rawData);
    const personalMessage =
      validatedInput.personalMessage ??
      buildDefaultInvitationPersonalMessage(
        profile.firmName,
        validatedInput.intakeWaived ? validatedInput.includedPillars : undefined,
      );
    const invitationInput = { ...validatedInput, personalMessage };

    await assertCanAddClientForAdvisorProfile(profile.id);

    if (validatedInput.intakeWaived) {
      try {
        await assertAdvisorCanSkipIntake(userId);
      } catch (e) {
        return {
          success: false,
          error:
            e instanceof Error
              ? e.message
              : "Your firm administrator has not allowed team members to skip intake.",
        };
      }
    }

    if (validatedInput.intakeWaived && validatedInput.includedPillars?.length) {
      const { assertAdvisorAssessmentDomainSelection } = await import(
        "@/lib/methodology/advisor-assessment-domains"
      );
      await assertAdvisorAssessmentDomainSelection(
        profile.id,
        validatedInput.includedPillars,
      );
    }

    const features =
      (await getSubscriptionFeatures(profile.userId)) ??
      ESSENTIALS_SUBSCRIPTION_FEATURES;
    const invitationBranding = await resolveInvitationBrandingForAdvisor(
      profile.id,
      profile.firmName,
    );
    const emailTheme = invitationEmailThemeForProfile(
      {
        brandingEnabled: invitationBranding.brandingEnabled,
        logoUrl: invitationBranding.logoUrl,
        logoS3Key: invitationBranding.logoS3Key,
        primaryColor: invitationBranding.primaryColor,
        userId: profile.userId,
      },
      features,
    );

    const invitation = await createAdvisorInvitation(profile.id, invitationInput, {
      subscriptionFeatures: {
        customSubdomainEnabled: features.customSubdomainEnabled,
      },
    });

    const advisorInfo = {
      advisorName: profile.user.name || profile.user.firstName + " " + profile.user.lastName || "Advisor",
      advisorJobTitle: profile.jobTitle || "Financial Advisor",
      advisorFirmName: profile.firmName || "Advisory Firm",
      advisorEmail: profile.user.email,
      advisorPhone: profile.phone || "",
      advisorLicenseNumber: profile.licenseNumber || "",
    };

    const emailResult = await sendInvitationEmail({
      clientEmail: validatedInput.clientEmail,
      advisorInfo,
      personalMessage: invitationInput.personalMessage,
      invitationUrl: invitation.url,
      clientName: validatedInput.clientName,
      profile: invitationBranding,
      theme: emailTheme,
    });

    // Audit AFTER both the invite-row write and the email send. The email's
    // success/failure is recorded in metadata so we have a single audit row
    // for "this advisor sent invite X" with delivery outcome attached.
    // prefillEmail will be hashed by the redactor on persist.
    await writeAudit({
      actor: { userId, role: role as UserRole, email: actorEmail },
      action: AUDIT_ACTIONS.INVITE_SEND,
      entityType: "InviteCode",
      entityId: invitation.id,
      beforeData: null,
      afterData: {
        code: invitation.code,
        prefillEmail: validatedInput.clientEmail,
        intakeWaived: validatedInput.intakeWaived,
        includedPillars: validatedInput.includedPillars,
      },
      metadata: {
        advisorId: profile.id,
        brandingEnabled: emailTheme.brandingEnabled,
        emailSent: emailResult.sent,
        emailNotSentReason: emailResult.sent ? undefined : emailResult.reason,
      },
    });

    return {
      success: true,
      data: {
        ...invitation,
        emailSent: emailResult.sent,
        emailNotSentReason: emailResult.sent ? undefined : emailResult.reason,
      },
    };
  } catch (error) {
    if (error instanceof ClientLimitError) {
      return { success: false, error: error.message };
    }
    if (error instanceof DuplicateInvitationError) {
      return { success: false, error: error.message };
    }
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unexpected error occurred while sending the invitation." };
  }
}

/**
 * Server action to resend an existing invitation
 */
export async function resendInvitationAction(invitationId: string): Promise<ActionResult<InvitationWithDetails & { url: string; emailSent: boolean; emailNotSentReason?: string }>> {
  try {
    // Authenticate and get advisor role
    const { userId, role, email: actorEmail } = await requireAdvisorRole();

    // Get advisor profile with user info
    const profile = await getAdvisorProfileOrThrow(userId);

    // Resend the invitation (this validates ownership and limits)
    const features =
      (await getSubscriptionFeatures(profile.userId)) ??
      ESSENTIALS_SUBSCRIPTION_FEATURES;

    const invitation = await resendInvitation(profile.id, invitationId, {
      subscriptionFeatures: {
        customSubdomainEnabled: features.customSubdomainEnabled,
      },
    });

    const invitationBranding = await resolveInvitationBrandingForAdvisor(
      profile.id,
      profile.firmName,
    );
    const emailTheme = invitationEmailThemeForProfile(
      {
        brandingEnabled: invitationBranding.brandingEnabled,
        logoUrl: invitationBranding.logoUrl,
        logoS3Key: invitationBranding.logoS3Key,
        primaryColor: invitationBranding.primaryColor,
        userId: profile.userId,
      },
      features,
    );

    const advisorInfo = {
      advisorName: profile.user.name || profile.user.firstName + " " + profile.user.lastName || "Advisor",
      advisorJobTitle: profile.jobTitle || "Financial Advisor",
      advisorFirmName: profile.firmName || "Advisory Firm",
      advisorEmail: profile.user.email,
      advisorPhone: profile.phone || "",
      advisorLicenseNumber: profile.licenseNumber || "",
    };

    const emailResult = await sendInvitationEmail({
      clientEmail: invitation.prefillEmail || "",
      advisorInfo,
      personalMessage:
        invitation.personalMessage ||
        buildDefaultInvitationPersonalMessage(
          profile.firmName,
          invitation.includedPillars?.length ? invitation.includedPillars : undefined,
        ),
      invitationUrl: invitation.url,
      clientName: invitation.clientName || undefined,
      profile: invitationBranding,
      theme: emailTheme,
    });

    await writeAudit({
      actor: { userId, role: role as UserRole, email: actorEmail },
      action: AUDIT_ACTIONS.INVITE_RESEND,
      entityType: "InviteCode",
      entityId: invitation.id,
      // No before/after diff — resend is logically a delivery retry, not a
      // state change. Existence of the resend is the auditable event.
      metadata: {
        advisorId: profile.id,
        prefillEmail: invitation.prefillEmail,
        brandingEnabled: emailTheme.brandingEnabled,
        emailSent: emailResult.sent,
        emailNotSentReason: emailResult.sent ? undefined : emailResult.reason,
      },
    });

    return {
      success: true,
      data: {
        ...invitation,
        emailSent: emailResult.sent,
        emailNotSentReason: emailResult.sent ? undefined : emailResult.reason,
      },
    };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unexpected error occurred while resending the invitation." };
  }
}

/**
 * Server action to manually expire an invitation
 */
export async function expireInvitationAction(invitationId: string): Promise<ActionResult<InvitationWithDetails>> {
  try {
    // Authenticate and get advisor role
    const { userId, role, email: actorEmail } = await requireAdvisorRole();

    // Get advisor profile
    const profile = await getAdvisorProfileOrThrow(userId);

    // Expire the invitation (this validates ownership)
    const invitation = await expireInvitation(profile.id, invitationId);

    await writeAudit({
      actor: { userId, role: role as UserRole, email: actorEmail },
      action: AUDIT_ACTIONS.INVITE_EXPIRE,
      entityType: "InviteCode",
      entityId: invitation.id,
      // The status transition itself is captured in metadata (we don't have
      // the prior status without an extra read; expireInvitation enforces
      // ownership and returns the post-state, so the metadata.fromStatus is
      // unknown here — left to the queryable invitation row's history).
      metadata: {
        advisorId: profile.id,
        toStatus: "EXPIRED",
        prefillEmail: invitation.prefillEmail,
      },
    });

    return { success: true, data: invitation };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unexpected error occurred while expiring the invitation." };
  }
}

/**
 * Server action to get advisor's invitations
 */
export async function getInvitationsAction(
  filters?: InvitationListFilters,
  pagination?: { page: number; pageSize: number }
): Promise<ActionResult<InvitationListResult>> {
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);
    const policyContext = await getAdvisorClientDataPolicyContext(userId);
    const result = await getAdvisorInvitations(profile.id, filters, pagination, {
      pseudonymousWorkspaceLabeling:
        policyContext.effective.pseudonymousWorkspaceLabeling,
    });
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "An unexpected error occurred while fetching invitations." };
  }
}