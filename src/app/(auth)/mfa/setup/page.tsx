import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdvisorHubNavRole } from "@/lib/auth-roles";
import { MFASetupForm } from "./MFASetupForm";

/**
 * MFA setup: generates a TOTP secret (QR + manual key) but does not
 * activate MFA until the user verifies a code on this page.
 * Advisor/admin accounts only — clients use magic-link auth.
 */
export default async function MFASetupPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/signin?callbackUrl=/mfa/setup");
  }

  if (!isAdvisorHubNavRole(session.user.role)) {
    redirect("/settings");
  }

  if (session.user.mfaEnabled) {
    redirect("/settings");
  }

  return <MFASetupForm />;
}
