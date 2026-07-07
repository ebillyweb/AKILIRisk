import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { safeAfterSignInPath } from "@/lib/auth-callback-path";
import { verifyInviteToken } from "@/lib/invite";
import { redeemInvitationFromToken } from "@/lib/invitations/redeem-invitation";
import { buildInvitationMagicLinkVerifyPath } from "@/lib/invitations/invitation-signup-redirect";
import { prisma } from "@/lib/db";
import {
  ClientSignupInfoPanel,
  InviteAcceptFailure,
} from "@/components/auth/InviteAcceptFailure";
import { BrandingProvider } from "@/components/providers/BrandingProvider";
import { BrandedAuthShell } from "@/components/auth/BrandedAuthShell";
import { BrandingUnavailable } from "@/components/branding/BrandingUnavailable";
import { ClientPortalRootTheme } from "@/components/branding/ClientPortalRootTheme";
import {
  getInvitingAdvisorBrandingForInviteCode,
  withClientPortalLogoSrc,
} from "@/lib/client/resolve-client-portal-branding";
import {
  inviteSignupExpectsBranding,
  isTenantBrandedRequest,
} from "@/lib/client/branded-portal-requirements";
import { tenantPublicPath } from "@/lib/client/tenant-path-prefix";

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

  const inviteCodeId = verifyInviteToken(inviteToken);
  if (!inviteCodeId) {
    return (
      <InviteAcceptFailure message="This invitation link is invalid or has expired." />
    );
  }

  const session = await auth();
  if (session?.user) {
    const sessionEmail = session.user.email?.trim().toLowerCase() ?? "";
    const invite = await prisma.inviteCode.findUnique({
      where: { id: inviteCodeId },
      select: { prefillEmail: true, intakeWaived: true },
    });
    const inviteEmail = invite?.prefillEmail?.trim().toLowerCase() ?? "";

    if (
      session.user.role === "USER" &&
      sessionEmail &&
      inviteEmail &&
      sessionEmail === inviteEmail
    ) {
      const redeemed = await redeemInvitationFromToken(inviteToken);
      if (redeemed.ok) {
        const defaultCallback = invite?.intakeWaived ? "/assessment" : "/intake";
        redirect(
          await tenantPublicPath(
            safeAfterSignInPath(sp.callbackUrl, defaultCallback),
          ),
        );
      }
    }

    if (sessionEmail && inviteEmail && sessionEmail !== inviteEmail) {
      return (
        <InviteAcceptFailure message="This invitation is for a different email address. Sign out and open the link again, or sign in with the invited email." />
      );
    }

    redirect(
      await tenantPublicPath(safeAfterSignInPath(sp.callbackUrl, "/dashboard")),
    );
  }

  const onTenantHost = await isTenantBrandedRequest();
  if (!onTenantHost) {
    const expectsBranding = await inviteSignupExpectsBranding(inviteCodeId);
    const inviteBranding = await getInvitingAdvisorBrandingForInviteCode(
      inviteCodeId
    );

    if (expectsBranding && !inviteBranding) {
      return <BrandingUnavailable audience="client" />;
    }

    if (inviteBranding) {
      const branding = withClientPortalLogoSrc(inviteBranding);
      return (
        <BrandingProvider branding={branding} subdomain={null}>
          <ClientPortalRootTheme branding={branding} />
          <BrandedAuthShell branding={branding}>
            <InviteSignupRedirect
              inviteToken={inviteToken}
              callbackUrl={sp.callbackUrl}
            />
          </BrandedAuthShell>
        </BrandingProvider>
      );
    }
  }

  return (
    <InviteSignupRedirect
      inviteToken={inviteToken}
      callbackUrl={sp.callbackUrl}
    />
  );
}

async function InviteSignupRedirect({
  inviteToken,
  callbackUrl,
}: {
  inviteToken: string;
  callbackUrl?: string;
}) {
  const completion = await buildInvitationMagicLinkVerifyPath(
    inviteToken,
    callbackUrl,
  );
  if (!completion.ok) {
    return <InviteAcceptFailure message={completion.error} />;
  }

  redirect(completion.verifyPath);
}
