import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { clientIpFromRequest } from "@/lib/request-ip";
import crypto from "crypto";

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

/** Look up the public origin for the password-reset link. In production we
 *  refuse to fall back to localhost — a wrong link in a recovery email is
 *  worse than the email never being sent. Non-production keeps the
 *  localhost fallback so dev/staging still work without env config. */
function resolvePublicBaseUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_URL?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    console.error(
      "NEXT_PUBLIC_URL is not configured; refusing to send reset email with localhost link"
    );
    return null;
  }
  return "http://localhost:3000";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = forgotPasswordSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { email } = validation.data;

    // Rate limit on (ip, email) so a known email can't be locked out by a
    // single attacker, and a single IP can't spam many emails. Each key
    // gets 3 attempts/hour. Email-only keying (the previous behavior) let
    // an attacker DoS password recovery for any victim by hitting the
    // endpoint with that email a few times.
    const ip = clientIpFromRequest(req) ?? "unknown";
    const rateLimitResult = rateLimit({
      key: `forgot-password:${ip}:${email}`,
      limit: 3,
      windowMs: 60 * 60 * 1000,
    });
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many reset requests. Please try again later.",
          resetAt: new Date(rateLimitResult.resetAt).toISOString(),
        },
        { status: 429 }
      );
    }

    // Refuse to proceed if we can't build a valid recovery URL (production
    // missing NEXT_PUBLIC_URL). Bail before the user lookup so the failure
    // shape is identical regardless of email validity.
    const baseUrl = resolvePublicBaseUrl();
    if (!baseUrl) {
      return NextResponse.json(
        { error: "Password reset is temporarily unavailable" },
        { status: 503 }
      );
    }

    // Look up user by email. Filter out soft-deleted accounts: `signIn`
    // already blocks them at the auth callback (see src/lib/auth.ts), but
    // sending a reset email to a deactivated account is wasted work and
    // confirms the account ever existed (mild PII leak). `findFirst` with
    // a deletedAt filter behaves identically to `findUnique({ email })`
    // for active accounts, and returns null for soft-deleted ones.
    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: { id: true, email: true },
    });

    // Email enumeration mitigation has two pieces:
    //   1. Same response body for existing/non-existing emails (below).
    //   2. Move the slow path (token persistence + email send) off the
    //      response timeline. We `void` the helper instead of awaiting so
    //      the response returns in DB-lookup time regardless of whether we
    //      have work to do. Previously the known-email branch waited on a
    //      Resend round-trip (~100–500ms) while the unknown branch
    //      returned in ~5ms — a measurable side-channel.
    if (user) {
      void issueResetEmail(user.email, baseUrl);
    }

    // Generic success response (same for existing and non-existing emails)
    return NextResponse.json(
      {
        message:
          "If an account exists with that email, a reset link has been sent",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

/** Background work for the known-email branch. Runs after the response is
 *  sent so its latency doesn't leak via response timing. Errors are logged
 *  but never propagate to the client. */
async function issueResetEmail(email: string, baseUrl: string): Promise<void> {
  try {
    // Delete any existing unexpired tokens for this email
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: email,
        expires: { gt: new Date() },
      },
    });

    // Generate reset token (raw token sent to user)
    const rawToken = crypto.randomBytes(32).toString("hex");
    // Hash before persisting so a DB read never exposes a usable token.
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    // 15-minute expiry
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: hashedToken,
        expires: expiresAt,
      },
    });

    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;
    await sendPasswordResetEmail(email, resetUrl);
  } catch (e) {
    console.error("Background reset-email task failed:", e);
  }
}
