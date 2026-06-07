import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { hasPendingConsent } from "@/lib/advisor/pending-consent";
import { sanitizeMagicLinkRedirectTo } from "@/lib/auth/sign-in-routes";

/** Paths reachable while consent decisions are still outstanding. */
export function isConsentPendingExemptPath(pathname: string): boolean {
  return (
    pathname === "/consent/pending" || pathname.startsWith("/consent/")
  );
}

/** Safe post-consent destination (magic-link / deep-link aware). */
export function resolveConsentReturnPath(
  raw: string | null | undefined,
  fallback = "/dashboard"
): string {
  return sanitizeMagicLinkRedirectTo(raw, fallback);
}

/** Build `/consent/pending` preserving the client's intended next page. */
export function consentPendingHref(intendedPath?: string | null): string {
  if (!intendedPath || isConsentPendingExemptPath(intendedPath.split("?")[0] ?? "")) {
    return "/consent/pending";
  }
  const safe = sanitizeMagicLinkRedirectTo(intendedPath, "");
  if (!safe) {
    return "/consent/pending";
  }
  return `/consent/pending?redirectTo=${encodeURIComponent(safe)}`;
}

/**
 * Redirect clients with null `fieldVisibility` on any ACTIVE assignment
 * to `/consent/pending` before other protected surfaces render.
 *
 * Call from `(protected)/layout` for role=USER sessions after MFA.
 */
export async function redirectIfPendingConsent(
  clientUserId: string
): Promise<void> {
  const headerList = await headers();
  const pathname = headerList.get("x-akili-pathname") ?? "";
  if (isConsentPendingExemptPath(pathname)) {
    return;
  }

  if (await hasPendingConsent(clientUserId)) {
    redirect(consentPendingHref(pathname));
  }
}
