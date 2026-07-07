import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { getMfaUserState } from "@/lib/auth/mfa-user-state";
import { getTenantPathPrefixFromHeaders } from "@/lib/client/tenant-path-prefix";
import { scopePathToTenantPrefix } from "@/lib/client/tenant-path-prefix-client";
import { MFAVerifyForm } from "./MFAVerifyForm";

/**
 * MFA verify page: only shown when the user has MFA enabled.
 * If the user is signed in but does not have MFA enabled, redirect to dashboard (or callbackUrl).
 * This avoids showing the TOTP form to clients who only use the invite-code flow.
 */
export default async function MFAVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();

  // Keep redirects inside the tenant portal in path-portal mode (the proxy
  // rewrote `/t/{slug}/mfa/verify` and forwarded the prefix in this header).
  const tenantPathPrefix = await getTenantPathPrefixFromHeaders();

  if (!session?.user) {
    redirect(scopePathToTenantPrefix("/signin?callbackUrl=/mfa/verify", tenantPathPrefix));
  }

  const params = await searchParams;
  const callbackUrl =
    typeof params.callbackUrl === "string" ? params.callbackUrl : "/dashboard";

  const mfaState = await getMfaUserState(session.user.id);

  if (!mfaState?.mfaEnabled) {
    const dest = callbackUrl.startsWith("/") ? callbackUrl : "/dashboard";
    redirect(scopePathToTenantPrefix(dest, tenantPathPrefix));
  }

  if (session.user.mfaVerified) {
    const dest = callbackUrl.startsWith("/") ? callbackUrl : "/dashboard";
    redirect(scopePathToTenantPrefix(dest, tenantPathPrefix));
  }

  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading verification screen...
        </div>
      }
    >
      <MFAVerifyForm callbackUrl={callbackUrl} />
    </Suspense>
  );
}
