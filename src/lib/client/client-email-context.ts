import "server-only";

import { prisma } from "@/lib/db";
import { findUserByEmail } from "@/lib/auth/user-email";
import { getAssignedAdvisorBrandingForClient } from "@/lib/client/assigned-advisor-branding";
import { clientPortalBrandingDisplayTitle } from "@/lib/client/client-portal-branding";
import { buildAdvisorPortalOrigin } from "@/lib/client/client-portal-origin";
import { getInvitingAdvisorBrandingForInviteCode } from "@/lib/client/resolve-client-portal-branding";
import { getPublicAppUrlFromEnv, getPublicAppUrlStrict } from "@/lib/public-app-url";
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
      subdomain: {
        select: {
          subdomain: true,
          isActive: true,
          dnsVerified: true,
        },
      },
    },
  });

  const row = profile?.subdomain;
  if (row?.isActive && row.dnsVerified && row.subdomain) {
    return {
      origin: buildAdvisorPortalOrigin(row.subdomain),
      usesTenantHost: true,
    };
  }

  return { origin: platformOrigin, usesTenantHost: false };
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

export function clientPortalUrl(
  context: ClientEmailContext | null,
  path: string,
): string {
  const origin = context?.portalOrigin ?? resolvePlatformOrigin();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${origin.replace(/\/$/, "")}${normalizedPath}`;
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

  const branding =
    userId != null
      ? await getAssignedAdvisorBrandingForClient(userId)
      : null;

  const { origin, usesTenantHost } = await resolvePortalOriginForAdvisor(
    advisorProfileId,
    Boolean(branding?.brandingEnabled),
  );

  return buildContextFromAssignment({
    userId,
    advisorProfileId,
    branding,
    advisorName,
    portalOrigin: origin,
    usesTenantHost,
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

  const { resolveAdvisorBrandingForProfile } = await import(
    "@/lib/enterprise/branding"
  );
  const branding = await resolveAdvisorBrandingForProfile(advisorProfileId, {
    scope: "client",
  });
  const { origin, usesTenantHost } = await resolvePortalOriginForAdvisor(
    advisorProfileId,
    Boolean(branding?.brandingEnabled),
  );

  return buildContextFromAssignment({
    userId: null,
    advisorProfileId,
    branding,
    advisorName: formatAdvisorDisplayName(advisor.user),
    portalOrigin: origin,
    usesTenantHost,
  });
}
