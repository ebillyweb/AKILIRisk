import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdvisorHubNavRole } from "@/lib/auth-roles";
import { buildSignInHref } from "@/lib/auth/sign-in-routes";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function ChangePasswordPage() {
  const session = await auth();

  if (!session?.user) {
    redirect(buildSignInHref({ callbackUrl: "/change-password" }));
  }

  if (!isAdvisorHubNavRole(session.user.role)) {
    redirect("/settings");
  }

  return (
    <ChangePasswordForm required={Boolean(session.user.passwordChangeRequired)} />
  );
}
