import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { buildSignInHref } from "@/lib/auth/sign-in-routes";
import { StartAssessmentClient } from "@/app/(auth)/start/StartAssessmentClient";
import { isTenantBrandedRequest } from "@/lib/client/branded-portal-requirements";
import { tenantPublicPath } from "@/lib/client/tenant-path-prefix";

export default async function StartAssessmentPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; callbackUrl?: string }>;
}) {
  const sp = await searchParams;
  const inviteToken = sp.invite?.trim();

  if (inviteToken) {
    const params = new URLSearchParams({ invite: inviteToken });
    if (sp.callbackUrl?.trim()) {
      params.set("callbackUrl", sp.callbackUrl.trim());
    }
    redirect(await tenantPublicPath(`/signup?${params.toString()}`));
  }

  const session = await auth();
  if (session?.user?.role === "USER") {
    redirect(await tenantPublicPath("/dashboard"));
  }

  const onTenantHost = await isTenantBrandedRequest();
  const signInHref = await tenantPublicPath(
    buildSignInHref({ role: "client" }),
  );
  const requestReviewHref = await tenantPublicPath("/request-review");

  return (
    <StartAssessmentClient
      signInHref={signInHref}
      requestReviewHref={requestReviewHref}
      invitedViaEmailHint={onTenantHost}
    />
  );
}
