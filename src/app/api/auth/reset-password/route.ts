import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { clientIpFromRequest } from "@/lib/request-ip";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import { findUserByEmail } from "@/lib/auth/user-email";
import {
  validatePasswordForSet,
  passwordComplexitySchema,
} from "@/lib/auth/password-policy";
import { getPasswordPolicy } from "@/lib/platform/password-policy-settings";
import {
  hashPasswordForStorage,
} from "@/lib/auth/password-update";
import crypto from "crypto";

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  email: z
    .string()
    .email("Invalid email address")
    .transform((s) => s.trim().toLowerCase()),
  password: passwordComplexitySchema,
});

export async function POST(req: NextRequest) {
  try {
    // Rate limit by IP. Token entropy makes brute-forcing the token field
    // infeasible, but a stolen reset link in a 15-minute window is an
    // attacker-known secret; throttling caps how many bcrypt-cost-12
    // attempts an attacker can make against a known-token-but-unknown-
    // password scenario, and dampens generic enumeration on the endpoint.
    const ip = clientIpFromRequest(req) ?? "unknown";
    const rateLimitResult = rateLimit({
      key: `reset-password:${ip}`,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many reset attempts. Please try again later.",
          resetAt: new Date(rateLimitResult.resetAt).toISOString(),
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const validation = resetPasswordSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { token: rawToken, email, password } = validation.data;

    const policy = await getPasswordPolicy();
    const passwordPolicy = await validatePasswordForSet(password, policy);
    if (!passwordPolicy.ok) {
      return NextResponse.json({ error: passwordPolicy.error }, { status: 400 });
    }

    // Hash the provided token to match database storage
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    // Look up token in database
    const verificationToken = await prisma.verificationToken.findUnique({
      where: {
        identifier_token: {
          identifier: email,
          token: hashedToken,
        },
      },
    });

    // Validate token exists and hasn't expired
    if (!verificationToken || verificationToken.expires < new Date()) {
      return NextResponse.json(
        { error: "Invalid or expired reset link" },
        { status: 400 }
      );
    }

    // Find user. Filter out soft-deleted accounts so a deactivated user
    // can't waste a DB write rotating a password they can't sign in with
    // anyway (signIn blocks them at the auth callback). Same shape as the
    // forgot-password route's lookup.
    // Round-11 commit 2.3 (BRD §5.1.AUTH / phase A): dual-read.
    const user = await findUserByEmail(email, {
      where: { deletedAt: null },
      select: { id: true, role: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired reset link" },
        { status: 400 }
      );
    }

    // Round-11 commit 3 (BRD §5.1.AUTH): clients (role=USER) authenticate
    // via magic link; password reset has no purpose for them. If a stale
    // reset link reaches a client account (legacy invite-flow leftover),
    // refuse with the same generic 400 used for invalid/expired tokens
    // — no role disclosure on the wire.
    if (user.role === "USER") {
      return NextResponse.json(
        { error: "Invalid or expired reset link" },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPasswordForStorage(password);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordChangeRequired: false,
          passwordPolicyRevision: policy.revision,
        },
      }),
      // Delete used token
      prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: email,
            token: hashedToken,
          },
        },
      }),
      // Invalidate all existing sessions for security
      prisma.session.deleteMany({
        where: { userId: user.id },
      }),
    ]);

    // Audit AFTER the transaction succeeds. password/hash never reach the
    // payload; the redactor would strip them anyway via the /password/i key
    // match if a future caller passed them in.
    await writeAudit({
      actor: { userId: user.id, email },
      action: AUDIT_ACTIONS.AUTH_PASSWORD_RESET_COMPLETED,
      entityType: "User",
      entityId: user.id,
      metadata: { sessionsInvalidated: true },
      request: req,
    });

    return NextResponse.json(
      { message: "Password reset successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
