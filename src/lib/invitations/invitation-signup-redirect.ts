import "server-only";

import { buildTenantScopedPublicPath } from "@/lib/advisor/tenant-path-portals";
import { acceptInvitationFromToken } from "@/lib/invitations/accept-invitation";
import { getTenantPathPrefixFromHeaders } from "@/lib/client/tenant-path-prefix";

export type InvitationSignupRedirectResult =
  | { ok: true; verifyPath: string }
  | { ok: false; error: string };

/**
 * Provisions the invited client and returns a magic-link verify URL.
 * Session cookies must be set in a Route Handler — never via a client
 * server-action loop on `/signup`.
 */
export async function buildInvitationMagicLinkVerifyPath(
  inviteToken: string,
  callbackUrl?: string | null,
): Promise<InvitationSignupRedirectResult> {
  const accepted = await acceptInvitationFromToken(inviteToken, callbackUrl);
  if (!accepted.ok) {
    return { ok: false, error: accepted.error };
  }

  const tenantPrefix = await getTenantPathPrefixFromHeaders();
  const redirectTo = buildTenantScopedPublicPath(
    accepted.redirectTo,
    tenantPrefix,
  );
  const params = new URLSearchParams({
    token: accepted.magicLinkToken,
    redirectTo,
  });

  return {
    ok: true,
    verifyPath: `/auth/magic-link/verify?${params.toString()}`,
  };
}
