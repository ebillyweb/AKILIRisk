import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { buildTenantScopedPublicPath } from "@/lib/advisor/tenant-path-portals";
import { hasPendingConsent } from "@/lib/advisor/pending-consent";
import { sanitizeMagicLinkRedirectTo } from "@/lib/auth/sign-in-routes";
import { getTenantPathPrefixFromHeaders } from "@/lib/client/tenant-path-prefix";
import { stripTenantPathPrefix } from "@/lib/client/tenant-path-prefix-client";

/** Paths reachable while consent decisions are still outstanding. */
export function isConsentPendingExemptPath(pathname: string): boolean {
  const pathOnly = stripTenantPathPrefix(pathname.split("?")[0] ?? pathname);
  return pathOnly === "/consent/pending" || pathOnly.startsWith("/consent/");
}

/** Safe post-consent destination (magic-link / deep-link aware). */
export function resolveConsentReturnPath(
  raw: string | null | undefined,
  fallback = "/dashboard",
): string {
  return sanitizeMagicLinkRedirectTo(raw, fallback);
}

/** Build `/consent/pending` preserving the client's intended next page. */
export function consentPendingHref(
  intendedPath?: string | null,
  tenantPathPrefix?: string | null,
): string {
  const pendingPath = buildTenantScopedPublicPath(
    "/consent/pending",
    tenantPathPrefix,
  );

  if (!intendedPath) {
    return pendingPath;
  }

  const intendedAppPath = stripTenantPathPrefix(
    intendedPath.split("?")[0] ?? intendedPath,
  );
  if (isConsentPendingExemptPath(intendedAppPath)) {
    return pendingPath;
  }

  const safe = sanitizeMagicLinkRedirectTo(intendedAppPath, "");
  if (!safe) {
    return pendingPath;
  }

  const scopedReturn = buildTenantScopedPublicPath(safe, tenantPathPrefix);
  return `${pendingPath}?redirectTo=${encodeURIComponent(scopedReturn)}`;
}

/**
 * Redirect clients with null `fieldVisibility` on any ACTIVE assignment
 * to `/consent/pending` before other protected surfaces render.
 *
 * Call from `(protected)/layout` for role=USER sessions after MFA.
 */
export async function redirectIfPendingConsent(
  clientUserId: string,
): Promise<void> {
  const headerList = await headers();
  const pathname = headerList.get("x-akili-pathname") ?? "";
  if (isConsentPendingExemptPath(pathname)) {
    return;
  }

  if (await hasPendingConsent(clientUserId)) {
    const tenantPrefix = await getTenantPathPrefixFromHeaders();
    const appPath = stripTenantPathPrefix(pathname.split("?")[0] ?? pathname);
    redirect(consentPendingHref(appPath, tenantPrefix));
  }
}
