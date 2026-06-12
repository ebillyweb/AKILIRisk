import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { resolvePostMfaSetupRedirect } from "@/lib/auth/mfa-setup-redirect";
import { getMfaUserState } from "@/lib/auth/mfa-user-state";
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

  return <MFASetupForm required={false} callbackUrl={callbackUrl} />;
}
