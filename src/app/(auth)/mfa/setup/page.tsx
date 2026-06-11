import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdvisorHubNavRole } from "@/lib/auth-roles";
import {
  getMfaUserState,
  resolvePostMfaSetupRedirect,
} from "@/lib/auth/mfa-setup-routing";
import { MFASetupForm } from "./MFASetupForm";

type PageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

/**
 * MFA setup: generates a TOTP secret (QR + manual key) but does not
 * activate MFA until the user verifies a code on this page.
 */
export default async function MFASetupPage({ searchParams }: PageProps) {
  const session = await auth();
  const { callbackUrl } = await searchParams;

  if (!session?.user?.id) {
    redirect("/signin?callbackUrl=/mfa/setup");
  }

  const mfaState = await getMfaUserState(session.user.id);

  if (mfaState?.mfaEnabled) {
    redirect(
      resolvePostMfaSetupRedirect({
        role: session.user.role,
        mfaVerified: session.user.mfaVerified,
        callbackUrl,
      })
    );
  }

  const mayEnroll =
    isAdvisorHubNavRole(session.user.role) ||
    Boolean(session.user.mfaEnrollmentRequired);

  if (!mayEnroll) {
    redirect("/signin?error=mfa_not_available");
  }

  return (
    <MFASetupForm
      required={Boolean(session.user.mfaEnrollmentRequired)}
      callbackUrl={callbackUrl}
    />
  );
}
