import "server-only";

import { prisma } from "@/lib/db";
import {
  invalidatePriorMagicLinkTokens,
  issueMagicLinkToken,
} from "@/lib/auth/magic-link";
import { safeAfterSignInPath } from "@/lib/auth-callback-path";
import { redeemInvitationFromToken } from "@/lib/invitations/redeem-invitation";

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
  const redeemed = await redeemInvitationFromToken(token);
  if (!redeemed.ok) {
    return redeemed;
  }

  const inviteCodeId = redeemed.inviteCodeId;

  const invite = await prisma.inviteCode.findUnique({
    where: { id: inviteCodeId },
    select: {
      prefillEmail: true,
      intakeWaived: true,
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

  await invalidatePriorMagicLinkTokens(email);
  const { rawToken } = await issueMagicLinkToken(email, { inviteCodeId });

  const defaultCallback = invite.intakeWaived ? "/assessment" : "/intake";
  const redirectTo = safeAfterSignInPath(callbackUrl, defaultCallback);

  return { ok: true, magicLinkToken: rawToken, redirectTo };
}
