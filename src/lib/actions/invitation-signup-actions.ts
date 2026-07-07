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
