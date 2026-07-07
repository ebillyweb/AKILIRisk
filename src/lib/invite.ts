import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";

const INVITE_TOKEN_TTL_SEC = 60 * 10; // 10 minutes
export const INVITATION_TTL_SEC = 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required for invite tokens");
  return secret;
}

export function createInviteToken(inviteCodeId: string): string {
  const exp = Math.floor(Date.now() / 1000) + INVITE_TOKEN_TTL_SEC;
  const payload = `${inviteCodeId}.${exp}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function createInvitationToken(inviteCodeId: string): string {
  const exp = Math.floor(Date.now() / 1000) + INVITATION_TTL_SEC;
  const payload = `${inviteCodeId}.${exp}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyInviteToken(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [inviteCodeId, expStr, sig] = parts;
    const exp = parseInt(expStr, 10);
    if (Number.isNaN(exp) || exp < Date.now() / 1000) return null;
    const payload = `${inviteCodeId}.${expStr}`;
    const expected = createHmac("sha256", getSecret()).update(payload).digest("base64url");
    if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(sig, "utf8"))) return null;
    return inviteCodeId;
  } catch {
    return null;
  }
}

export type ValidateInviteCodeResult =
  | { id: string }
  | { signInEmail: string }
  | { error: string };

export async function validateInviteCode(
  code: string,
): Promise<ValidateInviteCodeResult> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { error: "Please enter an invite code or PIN." };

  const invite = await prisma.inviteCode.findUnique({
    where: { code: normalized },
  });

  if (!invite) return { error: "Invalid invite code or PIN." };
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return { error: "This invite has expired." };
  }

  const invitedEmail = invite.prefillEmail?.trim().toLowerCase() ?? "";
  const atUseLimit =
    invite.maxUses != null && invite.usedCount >= invite.maxUses;

  if (atUseLimit) {
    if (invitedEmail) {
      return { signInEmail: invitedEmail };
    }
    return { error: "This invite has reached its use limit." };
  }

  return { id: invite.id };
}

export async function consumeInviteCode(inviteCodeId: string): Promise<void> {
  await prisma.inviteCode.update({
    where: { id: inviteCodeId },
    data: { usedCount: { increment: 1 } },
  });
}

/** Returns prefill email for signup form if the invite code has one and token is valid. */
export async function getPrefillEmailForToken(token: string): Promise<string | null> {
  const inviteCodeId = verifyInviteToken(token);
  if (!inviteCodeId) return null;
  const invite = await prisma.inviteCode.findUnique({
    where: { id: inviteCodeId },
    select: { prefillEmail: true },
  });
  return invite?.prefillEmail?.trim() || null;
}

/** Returns prefill data for signup form including email, client name, and advisor info. */
export async function getPrefillDataForToken(token: string): Promise<{
  prefillEmail: string | null;
  clientName: string | null;
  advisorName: string | null;
} | null> {
  const inviteCodeId = verifyInviteToken(token);
  if (!inviteCodeId) return null;

  const invite = await prisma.inviteCode.findUnique({
    where: { id: inviteCodeId },
    select: {
      prefillEmail: true,
      clientName: true,
      advisor: {
        select: {
          user: {
            select: { name: true, firstName: true, lastName: true }
          }
        }
      }
    },
  });

  if (!invite) return null;

  const advisorName = invite.advisor?.user?.name ||
    (invite.advisor?.user?.firstName && invite.advisor?.user?.lastName
      ? `${invite.advisor.user.firstName} ${invite.advisor.user.lastName}`.trim()
      : null);

  return {
    prefillEmail: invite.prefillEmail?.trim() || null,
    clientName: invite.clientName?.trim() || null,
    advisorName,
  };
}
