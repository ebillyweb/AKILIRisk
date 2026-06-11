import "server-only";

import { prisma } from "@/lib/db";

export type MfaUserState = {
  mfaEnabled: boolean;
  mfaSecret: boolean;
};

/** Authoritative MFA flags from the database (not the JWT cookie). */
export async function getMfaUserState(userId: string): Promise<MfaUserState | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaEnabled: true, mfaSecret: true },
  });
  if (!user) return null;
  return {
    mfaEnabled: user.mfaEnabled,
    mfaSecret: Boolean(user.mfaSecret),
  };
}

/**
 * Where to send a user who no longer belongs on `/mfa/setup`.
 * Never `/settings` — that route is workspace-gated and loops with the proxy
 * when the JWT cookie is stale.
 */
export function resolvePostMfaSetupRedirect(params: {
  role: string | null | undefined;
  mfaVerified: boolean | undefined;
  callbackUrl?: string | null;
}): string {
  if (!params.mfaVerified) {
    const verify = new URL("/mfa/verify", "http://local");
    if (params.callbackUrl) {
      verify.searchParams.set("callbackUrl", params.callbackUrl);
    }
    return `${verify.pathname}${verify.search}`;
  }

  const role = (params.role ?? "USER").toString().toUpperCase();
  if (role === "ADMIN" || role === "SUPER_ADMIN") return "/admin";
  if (role === "ADVISOR") return "/advisor";
  if (params.callbackUrl && params.callbackUrl.startsWith("/")) {
    return params.callbackUrl;
  }
  return "/dashboard";
}
