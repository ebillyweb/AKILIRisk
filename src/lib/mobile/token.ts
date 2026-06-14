import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

const MOBILE_TOKEN_TTL_SEC = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required for mobile tokens");
  return secret;
}

/**
 * Issues a stateless bearer token for the mobile app, HMAC-signed with
 * AUTH_SECRET (same primitive as invite tokens). Format: `userId.exp.sig`.
 */
export function createMobileToken(userId: string): string {
  const exp = Math.floor(Date.now() / 1000) + MOBILE_TOKEN_TTL_SEC;
  const payload = `${userId}.${exp}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyMobileToken(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [userId, expStr, sig] = parts;
    const exp = parseInt(expStr, 10);
    if (Number.isNaN(exp) || exp < Date.now() / 1000) return null;
    const payload = `${userId}.${expStr}`;
    const expected = createHmac("sha256", getSecret()).update(payload).digest("base64url");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(sig, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return userId;
  } catch {
    return null;
  }
}

export interface ResolvedUser {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  role: "USER" | "ADVISOR" | "ADMIN";
  advisorFirmName: string | null;
}

const ADMIN_EMAIL = "buddy@ebilly.com";

/**
 * Resolves the current user from either a mobile bearer token or a NextAuth
 * cookie session, so these endpoints serve both the app and the web.
 */
export async function resolveUser(request: NextRequest): Promise<ResolvedUser | null> {
  let userId: string | null = null;

  const authz = request.headers.get("authorization");
  if (authz?.startsWith("Bearer ")) {
    userId = verifyMobileToken(authz.slice("Bearer ".length).trim());
  }
  if (!userId) {
    const session = await auth();
    userId = session?.user?.id ?? null;
  }
  if (!userId) return null;
  return projectUser(userId);
}

/** Loads and shapes a user for the mobile/session contract. */
export async function projectUser(userId: string): Promise<ResolvedUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      role: true,
      advisorProfile: { select: { firmName: true } },
      clientAssignments: {
        where: { status: "ACTIVE" },
        select: { advisor: { select: { firmName: true } } },
        take: 1,
      },
    },
  });
  if (!user) return null;

  // ADMIN is only honored for the designated admin account (mirrors auth.ts).
  let role = user.role as ResolvedUser["role"];
  if (role === "ADMIN" && user.email !== ADMIN_EMAIL) role = "USER";

  const advisorFirmName =
    user.advisorProfile?.firmName ??
    user.clientAssignments[0]?.advisor.firmName ??
    null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    firstName: user.firstName,
    role,
    advisorFirmName,
  };
}

export async function projectUserByEmail(email: string): Promise<ResolvedUser | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true },
  });
  if (!user) return null;
  return projectUser(user.id);
}
