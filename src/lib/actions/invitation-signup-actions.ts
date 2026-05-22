"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { acceptInvitationFromToken } from "@/lib/invitations/accept-invitation";

export type CompleteInvitationSignupResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Provisions the client from an invite token and signs them in via magic link.
 * Used after the client-side opened beacon hits the tracking API.
 */
export async function completeInvitationSignup(
  token: string,
  callbackUrl?: string | null
): Promise<CompleteInvitationSignupResult> {
  const accepted = await acceptInvitationFromToken(token, callbackUrl);
  if (!accepted.ok) {
    return { ok: false, error: accepted.error };
  }

  await signIn("magic-link", {
    token: accepted.magicLinkToken,
    redirectTo: accepted.redirectTo,
  });

  redirect(accepted.redirectTo);
}
