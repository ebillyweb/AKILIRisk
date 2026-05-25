import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { TOTP } from "@otplib/totp";
import { NobleCryptoPlugin } from "@otplib/plugin-crypto-noble";
import { ScureBase32Plugin } from "@otplib/plugin-base32-scure";

import { isAdvisorHubNavRole } from "@/lib/auth-roles";
import { isTestAuthEnabled } from "@/lib/auth/test-auth-enabled";
import { findUserByEmail } from "@/lib/auth/user-email";
import { prisma } from "@/lib/db";
import { enrollMFA, enableMFA } from "@/lib/mfa";

const totp = new TOTP({
  crypto: new NobleCryptoPlugin(),
  base32: new ScureBase32Plugin(),
  issuer: "Akili Risk",
  digits: 6,
  period: 30,
  algorithm: "sha1",
});

const requestSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .transform((s) => s.trim().toLowerCase()),
  resetOnly: z.boolean().optional().default(false),
});

async function resetMfaForUser(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaEnabled: false,
      mfaSecret: null,
      mfaRecoveryCodes: null,
    },
  });
}

/**
 * Test-only MFA fixture endpoint (US-48 Playwright smokes).
 *
 * POST /api/test/mfa/prepare { email, resetOnly? }
 *   resetOnly=true — disable MFA for the advisor/admin test user.
 *   default — reset, enroll, enable MFA; return `{ secret, recoveryCodes }`.
 *
 * Gated by isTestAuthEnabled() — same contract as /api/test/magic-link/issue.
 */
export async function POST(req: NextRequest) {
  if (!isTestAuthEnabled()) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { email, resetOnly } = parsed.data;
    const user = await findUserByEmail(email, {
      select: { id: true, role: true },
    });

    if (!user?.id || !isAdvisorHubNavRole(user.role)) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await resetMfaForUser(user.id);

    if (resetOnly) {
      return NextResponse.json({ email, reset: true });
    }

    const { secret } = await enrollMFA(user.id);
    const token = await totp.generate({ secret });
    const recoveryCodes = await enableMFA(user.id, token);

    return NextResponse.json({
      email,
      secret,
      recoveryCodes,
    });
  } catch (error) {
    console.error("[test/mfa/prepare] error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
