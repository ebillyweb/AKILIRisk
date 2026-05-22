import "server-only";

import { prisma } from "@/lib/db";
import { safeAfterSignInPath } from "@/lib/auth-callback-path";
import {
  invalidatePriorMagicLinkTokens,
  issueMagicLinkToken,
} from "@/lib/auth/magic-link";
import { verifyInviteToken } from "@/lib/invite";
import { markInvitationOpened } from "@/lib/invitations/mark-opened";
import { provisionClientFromInviteCode } from "@/lib/invitations/provision-client";

export type AcceptInvitationResult =
  | { ok: true; magicLinkToken: string; redirectTo: string }
  | {
      ok: false;
      error: string;
      code: "invalid" | "expired" | "exhausted" | "no_email" | "blocked";
    };

export async function acceptInvitationFromToken(
  token: string,
  callbackUrl?: string | null,
): Promise<AcceptInvitationResult> {
  const inviteCodeId = verifyInviteToken(token);
  if (!inviteCodeId) {
    return {
      ok: false,
      error: "This invitation link is invalid or has expired.",
      code: "invalid",
    };
  }

  const invite = await prisma.inviteCode.findUnique({
    where: { id: inviteCodeId },
    select: {
      prefillEmail: true,
      intakeWaived: true,
      status: true,
    },
  });

  if (!invite) {
    return {
      ok: false,
      error: "This invitation is no longer valid.",
      code: "invalid",
    };
  }

  const email = invite.prefillEmail?.trim().toLowerCase() ?? "";
  if (!email) {
    return {
      ok: false,
      error: "This invitation is missing a client email. Ask your advisor to resend it.",
      code: "no_email",
    };
  }

  await markInvitationOpened(inviteCodeId);

  const provisioned = await provisionClientFromInviteCode(inviteCodeId, email);
  if (!provisioned.ok) {
    return {
      ok: false,
      error: provisioned.error,
      code:
        provisioned.code === "expired"
          ? "expired"
          : provisioned.code === "exhausted"
            ? "exhausted"
            : provisioned.code === "blocked"
              ? "blocked"
              : "invalid",
    };
  }

  await invalidatePriorMagicLinkTokens(email);
  const { rawToken } = await issueMagicLinkToken(email, { inviteCodeId });

  const defaultCallback = invite.intakeWaived ? "/assessment" : "/intake";
  const redirectTo = safeAfterSignInPath(callbackUrl, defaultCallback);

  return { ok: true, magicLinkToken: rawToken, redirectTo };
}
