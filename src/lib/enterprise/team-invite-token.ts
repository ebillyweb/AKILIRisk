import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

/** Team invite links remain valid for 7 days (matches client invitations). */
export const ENTERPRISE_TEAM_INVITE_TTL_SEC = 60 * 60 * 24 * 7;

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required for enterprise team invite tokens");
  return secret;
}

export function createEnterpriseTeamInviteToken(membershipId: string): string {
  const exp = Math.floor(Date.now() / 1000) + ENTERPRISE_TEAM_INVITE_TTL_SEC;
  const payload = `ent.${membershipId}.${exp}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyEnterpriseTeamInviteToken(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 4 || parts[0] !== "ent") return null;
    const membershipId = parts[1];
    const expStr = parts[2];
    const sig = parts[3];
    const exp = parseInt(expStr, 10);
    if (!membershipId || Number.isNaN(exp) || exp < Date.now() / 1000) return null;
    const payload = `ent.${membershipId}.${expStr}`;
    const expected = createHmac("sha256", getSecret()).update(payload).digest("base64url");
    if (
      expected.length !== sig.length ||
      !timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(sig, "utf8"))
    ) {
      return null;
    }
    return membershipId;
  } catch {
    return null;
  }
}

export function buildEnterpriseTeamInviteUrl(origin: string, token: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/enterprise/join?token=${encodeURIComponent(token)}`;
}
