import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { hasPendingConsent } from "@/lib/advisor/pending-consent";

/** Paths reachable while consent decisions are still outstanding. */
export function isConsentPendingExemptPath(pathname: string): boolean {
  return (
    pathname === "/consent/pending" || pathname.startsWith("/consent/")
  );
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
    redirect("/consent/pending");
  }
}
