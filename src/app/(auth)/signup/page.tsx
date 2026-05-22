import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { safeAfterSignInPath } from "@/lib/auth-callback-path";
import { verifyInviteToken } from "@/lib/invite";
import {
  ClientSignupInfoPanel,
  InviteAcceptFailure,
} from "@/components/auth/InviteAcceptFailure";
import { SignupInviteProcessor } from "@/components/auth/SignupInviteProcessor";

/**
 * Advisor invitation links land here (`/signup?invite=…&callbackUrl=…`).
 * Records opened (US-5), provisions the client, and signs in via magic link.
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

  const inviteCodeId = verifyInviteToken(inviteToken);
  if (!inviteCodeId) {
    return (
      <InviteAcceptFailure message="This invitation link is invalid or has expired." />
    );
  }

  return (
    <SignupInviteProcessor
      inviteCodeId={inviteCodeId}
      token={inviteToken}
      callbackUrl={sp.callbackUrl}
    />
  );
}
