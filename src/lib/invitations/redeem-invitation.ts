import "server-only";

import { InvitationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { findUserByEmail } from "@/lib/auth/user-email";
import { verifyInviteToken } from "@/lib/invite";
import { markInvitationOpened } from "@/lib/invitations/mark-opened";
import { provisionClientFromInviteCode } from "@/lib/invitations/provision-client";

export type RedeemInvitationResult =
  | { ok: true; inviteCodeId: string }
  | {
      ok: false;
      error: string;
      code: "invalid" | "expired" | "exhausted" | "no_email" | "blocked";
    };

/**
 * Marks an invitation opened and provisions the client/advisor link.
 * Does not issue a magic link — use when the client is already signed in.
 */
export async function redeemInvitationFromToken(
  token: string,
): Promise<RedeemInvitationResult> {
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
    select: { prefillEmail: true },
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

  return { ok: true, inviteCodeId };
}

/**
 * Backfills invitation status when a client completes intake without
 * going through the signup redemption flow (e.g. already signed in).
 */
export async function syncInvitationStatusForClientEmail(
  clientEmail: string,
  advisorProfileId?: string,
): Promise<void> {
  const normalizedEmail = clientEmail.trim().toLowerCase();
  if (!normalizedEmail) return;

  await prisma.inviteCode.updateMany({
    where: {
      prefillEmail: { equals: normalizedEmail, mode: "insensitive" },
      status: { in: [InvitationStatus.SENT, InvitationStatus.OPENED] },
      ...(advisorProfileId
        ? { createdBy: advisorProfileId }
        : { createdBy: { not: null } }),
    },
    data: {
      status: InvitationStatus.REGISTERED,
      statusUpdatedAt: new Date(),
    },
  });
}

/**
 * Repairs invitation rows left at SENT/OPENED when the invited client
 * already registered or finished intake under this advisor.
 */
export async function reconcileAdvisorInvitationStatuses(
  advisorProfileId: string,
): Promise<void> {
  const staleInvites = await prisma.inviteCode.findMany({
    where: {
      createdBy: advisorProfileId,
      status: { in: [InvitationStatus.SENT, InvitationStatus.OPENED] },
      prefillEmail: { not: null },
    },
    select: { id: true, prefillEmail: true },
  });

  for (const invite of staleInvites) {
    const email = invite.prefillEmail?.trim().toLowerCase();
    if (!email) continue;

    const user = await findUserByEmail(email, {
      where: { deletedAt: null, role: "USER" },
      select: { id: true },
    });

    let hasAssignment = false;
    if (user) {
      const assignment = await prisma.clientAdvisorAssignment.findFirst({
        where: {
          clientId: user.id,
          advisorId: advisorProfileId,
          status: "ACTIVE",
        },
        select: { id: true },
      });
      hasAssignment = Boolean(assignment);
    }

    if (!hasAssignment) {
      const provisioned = await provisionClientFromInviteCode(invite.id, email);
      if (!provisioned.ok) continue;
      hasAssignment = true;
    }

    if (!hasAssignment) continue;

    await prisma.inviteCode.update({
      where: { id: invite.id },
      data: {
        status: InvitationStatus.REGISTERED,
        statusUpdatedAt: new Date(),
      },
    });
  }
}
