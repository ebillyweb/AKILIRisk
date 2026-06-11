import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdvisorHubNavRole } from "@/lib/auth-roles";
import { isMfaEnrollmentRequiredForUser } from "@/lib/auth/mfa-enforcement";
import { getMfaRequiredForAllRoles } from "@/lib/platform/mfa-policy";
import { MFASetupForm } from "./MFASetupForm";

/**
 * MFA setup: generates a TOTP secret (QR + manual key) but does not
 * activate MFA until the user verifies a code on this page.
 * Required for staff accounts; optional for clients when platform policy demands it.
 */
export default async function MFASetupPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/signin?callbackUrl=/mfa/setup");
  }

  if (session.user.mfaEnabled) {
    redirect("/settings");
  }

  const mfaRequiredForAllRoles = await getMfaRequiredForAllRoles();
  const mayEnroll =
    isAdvisorHubNavRole(session.user.role) ||
    isMfaEnrollmentRequiredForUser({
      role: session.user.role,
      mfaEnabled: false,
      mfaRequiredForAllRoles,
    });

  if (!mayEnroll) {
    redirect("/settings");
  }

  return <MFASetupForm required={Boolean(session.user.mfaEnrollmentRequired)} />;
}
