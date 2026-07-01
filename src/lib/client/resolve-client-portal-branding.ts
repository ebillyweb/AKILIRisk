import "server-only";

import { InvitationStatus } from "@prisma/client";
import { userEmailForDisplay } from "@/lib/auth/user-email";
import { prisma } from "@/lib/db";
import { brandedPortalLogoImgSrc } from "@/lib/branding/branded-portal-logo";
import { getAssignedAdvisorBrandingForClient } from "@/lib/client/assigned-advisor-branding";
import { clientPortalLogoImgSrc } from "@/lib/client/client-portal-branding";
import { getTenantBrandingFromRequestHeaders } from "@/lib/client/tenant-portal-branding";
import { isTenantBrandedRequest } from "@/lib/client/branded-portal-requirements";
import { resolveAdvisorBrandingForProfile } from "@/lib/enterprise/branding";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

const INVITING_ADVISOR_STATUSES: InvitationStatus[] = [
  InvitationStatus.SENT,
  InvitationStatus.OPENED,
  InvitationStatus.REGISTERED,
];

export function withClientPortalLogoSrc(
  branding: AdvisorBrandingData,
  preferBrandedLogoApi = false
): AdvisorBrandingData {
  const logoSrc = preferBrandedLogoApi
    ? brandedPortalLogoImgSrc(branding) ?? clientPortalLogoImgSrc(branding)
    : clientPortalLogoImgSrc(branding) ?? brandedPortalLogoImgSrc(branding);

  if (!logoSrc) return branding;
  return { ...branding, logoUrl: logoSrc };
}

async function resolveClientEmailForBranding(
  userId: string,
  sessionEmail?: string | null
): Promise<string> {
  const fromSession = sessionEmail?.trim().toLowerCase() ?? "";
  if (fromSession) return fromSession;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailCiphertext: true },
  });
  if (!user) return "";

  return userEmailForDisplay(user).trim().toLowerCase();
}

async function getInvitingAdvisorBrandingForEmail(
  userId: string,
  clientEmail: string
): Promise<AdvisorBrandingData | null> {
  const normalizedEmail = clientEmail.trim().toLowerCase();
  if (!normalizedEmail) return null;

  // SECURITY: `prefillEmail` is attacker-controlled (any advisor can create an
  // invite for any email). Require the inviting advisor to also hold an ACTIVE
  // assignment to THIS client, so a stranger's invite can never inject their
  // firm name / logo / support contacts into the victim's portal.
  const invite = await prisma.inviteCode.findFirst({
    where: {
      prefillEmail: { equals: normalizedEmail, mode: "insensitive" },
      status: { in: INVITING_ADVISOR_STATUSES },
      createdBy: { not: null },
      advisor: {
        brandingEnabled: true,
        clientAssignments: { some: { clientId: userId, status: "ACTIVE" } },
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      advisorId: true,
    },
  });

  if (!invite?.advisorId) return null;
  return resolveAdvisorBrandingForProfile(invite.advisorId, { scope: "client" });
}

/** Branding for a specific invite row (signup page on platform host). */
export async function getInvitingAdvisorBrandingForInviteCode(
  inviteCodeId: string
): Promise<AdvisorBrandingData | null> {
  const invite = await prisma.inviteCode.findUnique({
    where: { id: inviteCodeId },
    select: {
      advisorId: true,
      advisor: {
        select: { brandingEnabled: true },
      },
    },
  });

  if (!invite?.advisorId || !invite.advisor?.brandingEnabled) return null;
  return resolveAdvisorBrandingForProfile(invite.advisorId, { scope: "client" });
}

/**
 * Resolves advisor branding for authenticated client routes (dashboard, intake,
 * assessment). Prefers active assignment, then tenant host headers, then the
 * most recent branded invitation for the client's email.
 */
export async function resolveClientPortalBrandingForUser(input: {
  userId: string;
  email?: string | null;
}): Promise<AdvisorBrandingData | null> {
  const clientEmail = await resolveClientEmailForBranding(
    input.userId,
    input.email
  );

  const [assignmentBranding, tenantBranding, onTenantHost, inviteBranding] =
    await Promise.all([
      getAssignedAdvisorBrandingForClient(input.userId),
      getTenantBrandingFromRequestHeaders(),
      isTenantBrandedRequest(),
      getInvitingAdvisorBrandingForEmail(input.userId, clientEmail),
    ]);

  const raw = onTenantHost
    ? (tenantBranding ?? assignmentBranding ?? inviteBranding)
    : (assignmentBranding ?? tenantBranding ?? inviteBranding);

  if (!raw) return null;

  const preferBrandedLogoApi = onTenantHost;
  return withClientPortalLogoSrc(raw, preferBrandedLogoApi);
}
