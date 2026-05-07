import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { clientIpFromRequest } from "@/lib/request-ip";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import { findUserByEmail } from "@/lib/auth/user-email";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  // Round-11 bug-hunt fix: normalize email casing — see commit A.
  // Both findUserByEmail (deterministic ciphertext, case-sensitive)
  // and the verificationToken `identifier` lookup at line ~127
  // require byte-equal input to match the request-time write.
  email: z
    .string()
    .email("Invalid email address")
    .transform((s) => s.trim().toLowerCase()),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character"
    ),
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

    // Hash new password with bcrypt (same cost factor as registration)
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update password and delete token in a transaction
    await prisma.$transaction([
      // Update user password
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
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
