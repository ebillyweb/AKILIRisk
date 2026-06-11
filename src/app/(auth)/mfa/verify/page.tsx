import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { getMfaUserState } from "@/lib/auth/mfa-user-state";
import { MFAVerifyForm } from "./MFAVerifyForm";

/**
 * MFA verify page: only shown when the user has MFA enabled.
 * If the user is signed in but does not have MFA enabled, redirect to dashboard (or callbackUrl).
 * This avoids showing the TOTP form to clients who only use the invite-code flow.
 */
export default async function MFAVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/signin?callbackUrl=/mfa/verify");
  }

  const params = await searchParams;
  const callbackUrl =
    typeof params.callbackUrl === "string" ? params.callbackUrl : "/dashboard";

  const mfaState = await getMfaUserState(session.user.id);

  if (!mfaState?.mfaEnabled) {
    const setup = new URL("/mfa/setup", "http://local");
    if (callbackUrl.startsWith("/")) {
      setup.searchParams.set("callbackUrl", callbackUrl);
    }
    redirect(`${setup.pathname}${setup.search}`);
  }

  if (session.user.mfaVerified) {
    redirect(callbackUrl.startsWith("/") ? callbackUrl : "/dashboard");
  }

  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading verification screen...
        </div>
      }
    >
      <MFAVerifyForm callbackUrl={callbackUrl} />
    </Suspense>
  );
}
