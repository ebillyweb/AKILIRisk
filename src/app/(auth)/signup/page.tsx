import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { safeAfterSignInPath } from "@/lib/auth-callback-path";
import { acceptInvitationFromToken } from "@/lib/invitations/accept-invitation";
import {
  ClientSignupInfoPanel,
  InviteAcceptFailure,
} from "@/components/auth/InviteAcceptFailure";

/**
 * Advisor invitation links land here (`/signup?invite=…&callbackUrl=…`).
 * Validates the invite, provisions the client account if needed, issues a
 * one-time magic-link token, and signs the client in immediately.
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; callbackUrl?: string }>;
}) {
  const sp = await searchParams;
  const inviteToken = sp.invite?.trim();

  if (!inviteToken) {
    return <ClientSignupInfoPanel />;
  }

  const session = await auth();
  if (session?.user) {
    redirect(safeAfterSignInPath(sp.callbackUrl, "/dashboard"));
  }

  const accepted = await acceptInvitationFromToken(inviteToken, sp.callbackUrl);
  if (!accepted.ok) {
    return <InviteAcceptFailure message={accepted.error} />;
  }

  await signIn("magic-link", {
    token: accepted.magicLinkToken,
    redirectTo: accepted.redirectTo,
  });

  redirect(accepted.redirectTo);
}
