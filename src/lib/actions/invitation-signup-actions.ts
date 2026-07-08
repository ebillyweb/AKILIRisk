"use server";

import { redirect } from "next/navigation";
import { buildInvitationMagicLinkVerifyPath } from "@/lib/invitations/invitation-signup-redirect";

export type CompleteInvitationSignupResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * @deprecated Prefer server-side redirect from `/signup` via
 * `buildInvitationMagicLinkVerifyPath`. Kept for callers that still
 * invoke this action directly.
 */
export async function completeInvitationSignup(
  token: string,
  callbackUrl?: string | null
): Promise<CompleteInvitationSignupResult> {
  const result = await buildInvitationMagicLinkVerifyPath(token, callbackUrl);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  redirect(result.verifyPath);
}

export type StartInvitedSignupState = { error?: string };

/**
 * Form action for the invited-client "Start your assessment" button.
 *
 * The account provisioning + single-use magic-link mint happen HERE, on an
 * explicit user click (a POST) — never on the `/signup` GET render. That keeps
 * email link-scanners / prefetchers (which only issue GETs) from provisioning
 * accounts or burning the one-time login token before the human arrives.
 *
 * Provisioning is idempotent: the first click creates the client account, and
 * later clicks (even after the invite's use limit is reached) simply log the
 * existing client back in.
 */
export async function startInvitedSignupAction(
  _prevState: StartInvitedSignupState,
  formData: FormData
): Promise<StartInvitedSignupState> {
  const token = formData.get("invite")?.toString().trim();
  const callbackUrl = formData.get("callbackUrl")?.toString() || undefined;

  if (!token) {
    return { error: "This invitation link is invalid or has expired." };
  }

  const result = await buildInvitationMagicLinkVerifyPath(token, callbackUrl);
  if (!result.ok) {
    return { error: result.error };
  }

  redirect(result.verifyPath);
}
