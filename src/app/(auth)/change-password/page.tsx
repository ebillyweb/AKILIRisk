import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdvisorHubNavRole } from "@/lib/auth-roles";
import { buildSignInHref } from "@/lib/auth/sign-in-routes";
import { safeAfterSignInPath } from "@/lib/auth-callback-path";
import { ChangePasswordForm } from "./ChangePasswordForm";

type PageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function ChangePasswordPage({ searchParams }: PageProps) {
  const { callbackUrl: rawCallbackUrl } = await searchParams;
  const callbackUrl = safeAfterSignInPath(rawCallbackUrl, "/advisor/settings");
  const session = await auth();

  if (!session?.user) {
    const returnPath = `/change-password?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    redirect(buildSignInHref({ callbackUrl: returnPath }));
  }

  if (!isAdvisorHubNavRole(session.user.role)) {
    redirect("/settings");
  }

  return (
    <ChangePasswordForm
      required={Boolean(session.user.passwordChangeRequired)}
      callbackUrl={callbackUrl}
    />
  );
}
