import {
  resolvePostSignInPath,
  safeAfterSignInPath,
} from "@/lib/auth-callback-path";

/**
 * Client-safe post-MFA-setup redirect helper.
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
      verify.searchParams.set(
        "callbackUrl",
        safeAfterSignInPath(params.callbackUrl),
      );
    }
    return `${verify.pathname}${verify.search}`;
  }

  return resolvePostSignInPath(params.callbackUrl, params.role);
}
