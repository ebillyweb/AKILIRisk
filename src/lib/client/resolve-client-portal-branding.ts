import "server-only";

import { InvitationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { brandedPortalLogoImgSrc } from "@/lib/branding/branded-portal-logo";
import { getAssignedAdvisorBrandingForClient } from "@/lib/client/assigned-advisor-branding";
import { clientPortalLogoImgSrc } from "@/lib/client/client-portal-branding";
import {
  ADVISOR_BRANDING_PROFILE_SELECT,
  mapAdvisorProfileToBrandingData,
} from "@/lib/client/advisor-branding-profile";
import { getTenantBrandingFromRequestHeaders } from "@/lib/client/tenant-portal-branding";
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

async function getInvitingAdvisorBrandingForEmail(
  clientEmail: string
): Promise<AdvisorBrandingData | null> {
  const normalizedEmail = clientEmail.trim().toLowerCase();
  if (!normalizedEmail) return null;

  const invite = await prisma.inviteCode.findFirst({
    where: {
      prefillEmail: normalizedEmail,
      status: { in: INVITING_ADVISOR_STATUSES },
      createdBy: { not: null },
      advisor: { brandingEnabled: true },
    },
    orderBy: { createdAt: "desc" },
    select: {
      advisor: {
        select: ADVISOR_BRANDING_PROFILE_SELECT,
      },
    },
  });

  const advisor = invite?.advisor;
  if (!advisor?.brandingEnabled) return null;
  return mapAdvisorProfileToBrandingData(advisor);
}

/**
 * Resolves advisor branding for authenticated client routes (dashboard, intake,
 * assessment). Prefers active assignment, then tenant host headers, then the
 * most recent branded invitation for the client's email.
 */
export async function resolveClientPortalBrandingForUser(input: {
  userId: string;
  email: string;
}): Promise<AdvisorBrandingData | null> {
  const [assignmentBranding, tenantBranding] = await Promise.all([
    getAssignedAdvisorBrandingForClient(input.userId),
    getTenantBrandingFromRequestHeaders(),
  ]);

  const raw =
    assignmentBranding ??
    tenantBranding ??
    (await getInvitingAdvisorBrandingForEmail(input.email));

  if (!raw) return null;

  const preferBrandedLogoApi = !assignmentBranding && !!tenantBranding;
  return withClientPortalLogoSrc(raw, preferBrandedLogoApi);
}
