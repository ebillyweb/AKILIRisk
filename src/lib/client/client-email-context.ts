import "server-only";

import { prisma } from "@/lib/db";
import { findUserByEmail } from "@/lib/auth/user-email";
import {
  ADVISOR_BRANDING_PROFILE_SELECT,
  mapAdvisorProfileToBrandingData,
} from "@/lib/client/advisor-branding-profile";
import { clientPortalBrandingDisplayTitle } from "@/lib/client/client-portal-branding";
import { buildAdvisorPortalOrigin } from "@/lib/client/client-portal-origin";
import { getInvitingAdvisorBrandingForInviteCode } from "@/lib/client/resolve-client-portal-branding";
import {
  ENTERPRISE_BRANDING_SELECT,
  hasConfiguredPersonalBrand,
  mapEnterpriseToBrandingData,
  resolveAdvisorBrandingForProfile,
} from "@/lib/enterprise/branding";
import { getPublicAppUrlFromEnv, getPublicAppUrlStrict } from "@/lib/public-app-url";
import { getSubscriptionFeatures } from "@/lib/subscription/validation";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

export type ClientEmailContext = {
  userId: string | null;
  advisorProfileId: string | null;
  branding: AdvisorBrandingData | null;
  isBranded: boolean;
  firmDisplayName: string;
  advisorName: string | null;
  portalOrigin: string;
  usesTenantHost: boolean;
};

type SubdomainRow = {
  subdomain: string;
  isActive: boolean;
  dnsVerified: boolean;
};

function resolvePlatformOrigin(): string {
  return getPublicAppUrlStrict() ?? getPublicAppUrlFromEnv();
}

function formatAdvisorDisplayName(input: {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): string | null {
  const full = input.name?.trim();
  if (full) return full;
  const first = input.firstName?.trim() ?? "";
  const last = input.lastName?.trim() ?? "";
  const combined = `${first} ${last}`.trim();
  return combined || null;
}

export function portalOriginFromSubdomainRow(
  row: SubdomainRow | null | undefined,
  platformOrigin: string,
): { origin: string; usesTenantHost: boolean } {
  if (row?.isActive && row.dnsVerified && row.subdomain) {
    return {
      origin: buildAdvisorPortalOrigin(row.subdomain),
      usesTenantHost: true,
    };
  }
  return { origin: platformOrigin, usesTenantHost: false };
}

async function resolvePortalOriginForAdvisor(
  advisorProfileId: string,
  brandingEnabled: boolean,
): Promise<{ origin: string; usesTenantHost: boolean }> {
  const platformOrigin = resolvePlatformOrigin();
  if (!brandingEnabled) {
    return { origin: platformOrigin, usesTenantHost: false };
  }

  const profile = await prisma.advisorProfile.findUnique({
    where: { id: advisorProfileId },
    select: {
      enterpriseId: true,
      subdomain: {
        select: {
          subdomain: true,
          isActive: true,
          dnsVerified: true,
        },
      },
    },
  });

  const personalOrigin = portalOriginFromSubdomainRow(
    profile?.subdomain,
    platformOrigin,
  );
  if (personalOrigin.usesTenantHost) {
    return personalOrigin;
  }

  if (profile?.enterpriseId) {
    const enterpriseSubdomain = await prisma.advisorSubdomain.findFirst({
      where: { enterpriseId: profile.enterpriseId },
      select: {
        subdomain: true,
        isActive: true,
        dnsVerified: true,
      },
    });
    return portalOriginFromSubdomainRow(enterpriseSubdomain, platformOrigin);
  }

  return personalOrigin;
}

function buildContextFromAssignment(input: {
  userId: string | null;
  advisorProfileId: string;
  branding: AdvisorBrandingData | null;
  advisorName: string | null;
  portalOrigin: string;
  usesTenantHost: boolean;
}): ClientEmailContext {
  const isBranded = Boolean(input.branding?.brandingEnabled);
  const firmDisplayName = isBranded
    ? clientPortalBrandingDisplayTitle(input.branding!)
    : "AKILI Risk Intelligence";

  return {
    userId: input.userId,
    advisorProfileId: input.advisorProfileId,
    branding: isBranded ? input.branding : null,
    isBranded,
    firmDisplayName,
    advisorName: input.advisorName,
    portalOrigin: input.portalOrigin,
    usesTenantHost: input.usesTenantHost,
  };
}

/**
 * Branding for client-facing emails. The standard resolver requires the
 * advisor/firm's `brandingEnabled` toggle to be on. Client emails go a step
 * further: if the toggle is off but the advisor (or their firm) is *entitled*
 * to branding (a paid tier — `basicBrandingEnabled`) AND has actually
 * configured brand assets (logo/colors/brand name), we still white-label the
 * email rather than falling back to the generic AKILI lockup. Scoped to email
 * so advisor portals/settings keep honoring the explicit toggle.
 */
async function resolveClientEmailBrandingForProfile(
  advisorProfileId: string,
): Promise<AdvisorBrandingData | null> {
  const toggled = await resolveAdvisorBrandingForProfile(advisorProfileId, {
    scope: "client",
  });
  if (toggled?.brandingEnabled) return toggled;

  const profile = await prisma.advisorProfile.findUnique({
    where: { id: advisorProfileId },
    select: {
      userId: true,
      enterpriseId: true,
      ...ADVISOR_BRANDING_PROFILE_SELECT,
    },
  });
  if (!profile) return null;

  const membership = await prisma.enterpriseMembership.findFirst({
    where: { advisorProfileId, status: "ACTIVE" },
    select: { enterpriseId: true, role: true },
  });
  const enterpriseId = profile.enterpriseId ?? membership?.enterpriseId ?? null;

  // "Eligible": entitled to branding on the resolved billing context (the firm's
  // subscription for enterprise members, the advisor's own otherwise).
  const features = await getSubscriptionFeatures(profile.userId);
  if (!features?.basicBrandingEnabled) return null;

  if (enterpriseId) {
    const enterprise = await prisma.advisorEnterprise.findUnique({
      where: { id: enterpriseId },
      select: ENTERPRISE_BRANDING_SELECT,
    });
    if (enterprise && hasConfiguredPersonalBrand(enterprise)) {
      return { ...mapEnterpriseToBrandingData(enterprise), brandingEnabled: true };
    }
    // Fall back to the member's personal brand only where the firm permits it.
    if (
      enterprise?.advisorMemberPersonalBrandingEnabled &&
      membership?.role === "ADVISOR" &&
      hasConfiguredPersonalBrand(profile)
    ) {
      return { ...mapAdvisorProfileToBrandingData(profile), brandingEnabled: true };
    }
    return null;
  }

  if (hasConfiguredPersonalBrand(profile)) {
    return { ...mapAdvisorProfileToBrandingData(profile), brandingEnabled: true };
  }
  return null;
}

async function buildClientEmailContextForAdvisorProfile(input: {
  userId: string | null;
  advisorProfileId: string;
  advisorName: string | null;
}): Promise<ClientEmailContext | null> {
  const branding = await resolveClientEmailBrandingForProfile(input.advisorProfileId);
  const { origin, usesTenantHost } = await resolvePortalOriginForAdvisor(
    input.advisorProfileId,
    Boolean(branding?.brandingEnabled),
  );

  return buildContextFromAssignment({
    userId: input.userId,
    advisorProfileId: input.advisorProfileId,
    branding,
    advisorName: input.advisorName,
    portalOrigin: origin,
    usesTenantHost,
  });
}

export function clientPortalUrl(
  context: ClientEmailContext | null,
  path: string,
): string {
  const origin = context?.portalOrigin ?? resolvePlatformOrigin();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${origin.replace(/\/$/, "")}${normalizedPath}`;
}

/**
 * Resolves white-label email context for an active client–advisor assignment.
 * Used by automated client reminder crons so branding and portal links match
 * the assigned practice (including enterprise firm branding and subdomain).
 */
export async function resolveClientEmailContextForClientAdvisorAssignment(input: {
  clientUserId: string;
  advisorProfileId: string;
  advisorUser?: {
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  };
}): Promise<ClientEmailContext | null> {
  return buildClientEmailContextForAdvisorProfile({
    userId: input.clientUserId,
    advisorProfileId: input.advisorProfileId,
    advisorName: input.advisorUser
      ? formatAdvisorDisplayName(input.advisorUser)
      : null,
  });
}

export async function resolveClientEmailContext(input: {
  userId?: string | null;
  email?: string | null;
  advisorProfileId?: string | null;
}): Promise<ClientEmailContext | null> {
  let userId = input.userId?.trim() || null;
  const email = input.email?.trim().toLowerCase() || null;

  if (!userId && email) {
    const user = await findUserByEmail(email, {
      where: { deletedAt: null },
      select: { id: true },
    });
    userId = user?.id ?? null;
  }

  let advisorProfileId = input.advisorProfileId?.trim() || null;
  let advisorName: string | null = null;

  if (userId) {
    const assignment = await prisma.clientAdvisorAssignment.findFirst({
      where: { clientId: userId, status: "ACTIVE" },
      orderBy: { assignedAt: "desc" },
      select: {
        advisorId: true,
        advisor: {
          select: {
            user: {
              select: { name: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });
    if (assignment) {
      advisorProfileId = advisorProfileId ?? assignment.advisorId;
      advisorName = formatAdvisorDisplayName(assignment.advisor.user);
    }
  }

  if (!advisorProfileId) {
    return null;
  }

  return buildClientEmailContextForAdvisorProfile({
    userId,
    advisorProfileId,
    advisorName,
  });
}

export async function resolveClientEmailContextForInviteCode(
  inviteCodeId: string,
): Promise<ClientEmailContext | null> {
  const invite = await prisma.inviteCode.findUnique({
    where: { id: inviteCodeId },
    select: {
      createdBy: true,
      advisor: {
        select: {
          user: {
            select: { name: true, firstName: true, lastName: true },
          },
        },
      },
    },
  });

  if (!invite?.createdBy || !invite.advisor) return null;

  const branding = await getInvitingAdvisorBrandingForInviteCode(inviteCodeId);
  const advisorName = formatAdvisorDisplayName(invite.advisor.user);
  const { origin, usesTenantHost } = await resolvePortalOriginForAdvisor(
    invite.createdBy,
    Boolean(branding?.brandingEnabled),
  );

  return buildContextFromAssignment({
    userId: null,
    advisorProfileId: invite.createdBy,
    branding,
    advisorName,
    portalOrigin: origin,
    usesTenantHost,
  });
}

export async function resolveClientEmailContextForAdvisorProfile(
  advisorProfileId: string,
): Promise<ClientEmailContext | null> {
  const advisor = await prisma.advisorProfile.findUnique({
    where: { id: advisorProfileId },
    select: {
      user: {
        select: { name: true, firstName: true, lastName: true },
      },
    },
  });
  if (!advisor) return null;

  return buildClientEmailContextForAdvisorProfile({
    userId: null,
    advisorProfileId,
    advisorName: formatAdvisorDisplayName(advisor.user),
  });
}
