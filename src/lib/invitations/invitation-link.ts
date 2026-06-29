import "server-only";

import { prisma } from "@/lib/db";
import {
  buildAdvisorPortalHostname,
  buildAdvisorPortalUrl,
  getProductionDomain,
  toTenantHostLabel,
} from "@/lib/advisor/platform-subdomain";
import { usesStagingTenantPathPortals } from "@/lib/advisor/tenant-path-portals";
import { getPublicAppUrlFromEnv } from "@/lib/public-app-url";
import type { SubscriptionFeatures } from "@/lib/validation/branding";

export type InvitationLinkContext = {
  /** Absolute origin, no trailing slash — e.g. https://firm.akilirisk.com */
  origin: string;
  /** Whether the link targets an advisor tenant host (white-label subdomain). */
  usesAdvisorSubdomain: boolean;
};

/** Thrown when branding is enabled but a tenant signup URL cannot be built. */
export class BrandedInvitationLinkNotReadyError extends Error {
  readonly code = "BRANDED_INVITE_LINK_NOT_READY" as const;

  constructor(
    message = "Your white-label subdomain is not ready. Claim and verify your subdomain in Settings before sending branded invitations."
  ) {
    super(message);
    this.name = "BrandedInvitationLinkNotReadyError";
  }
}

function buildAdvisorPortalOrigin(canonicalSlug: string): string {
  if (usesStagingTenantPathPortals()) {
    return buildAdvisorPortalUrl(canonicalSlug);
  }

  const domain = getProductionDomain();
  if (!domain) {
    const port = process.env.PORT?.trim() || "3000";
    const label = toTenantHostLabel(canonicalSlug);
    return `http://${label}.localhost:${port}`;
  }
  return `https://${buildAdvisorPortalHostname(canonicalSlug)}`;
}

/**
 * Resolves the public origin for invitation signup links.
 * Uses the advisor's verified platform subdomain when branding and the
 * subscription white-label entitlement are active. `customDomainEnabled`
 * governs bring-your-own-domain routing only — not `*.akilirisk.com` tenants.
 */
export async function resolveInvitationLinkContext(
  advisorProfileId: string,
  features: Pick<SubscriptionFeatures, "customSubdomainEnabled">
): Promise<InvitationLinkContext> {
  const profile = await prisma.advisorProfile.findUnique({
    where: { id: advisorProfileId },
    select: {
      brandingEnabled: true,
      subdomain: {
        select: {
          subdomain: true,
          isActive: true,
          dnsVerified: true,
        },
      },
    },
  });

  const defaultOrigin = getPublicAppUrlFromEnv();

  if (
    !profile?.brandingEnabled ||
    !features.customSubdomainEnabled
  ) {
    return { origin: defaultOrigin, usesAdvisorSubdomain: false };
  }

  const row = profile.subdomain;
  if (!row?.isActive || !row.dnsVerified || !row.subdomain) {
    return { origin: defaultOrigin, usesAdvisorSubdomain: false };
  }

  return {
    origin: buildAdvisorPortalOrigin(row.subdomain),
    usesAdvisorSubdomain: true,
  };
}

/**
 * Resolves invitation link origin for send/resend. When advisor branding is
 * enabled, fails closed instead of falling back to the platform host.
 */
export async function resolveInvitationLinkContextForSend(
  advisorProfileId: string,
  features: Pick<SubscriptionFeatures, "customSubdomainEnabled">
): Promise<InvitationLinkContext> {
  const profile = await prisma.advisorProfile.findUnique({
    where: { id: advisorProfileId },
    select: { brandingEnabled: true },
  });

  const linkContext = await resolveInvitationLinkContext(
    advisorProfileId,
    features
  );

  if (profile?.brandingEnabled && !linkContext.usesAdvisorSubdomain) {
    throw new BrandedInvitationLinkNotReadyError();
  }

  return linkContext;
}

export function buildInvitationSignupUrl(
  origin: string,
  inviteToken: string,
  callbackPath: "/intake" | "/assessment"
): string {
  const base = origin.replace(/\/$/, "");
  const params = new URLSearchParams({
    invite: inviteToken,
    callbackUrl: callbackPath,
  });
  return `${base}/signup?${params.toString()}`;
}
