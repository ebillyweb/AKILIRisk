import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { clientIpFromRequest } from "@/lib/request-ip";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import { findUserByEmail } from "@/lib/auth/user-email";
import { getPublicAppUrlStrict } from "@/lib/public-app-url";
import crypto from "crypto";

/** Short, non-reversible identifier for an email — used in the
 *  rate-limit key so the in-memory limiter (and any future Redis
 *  swap) doesn't transit raw email PII as part of its cache key. */
function rateLimitEmailKey(email: string): string {
  return crypto
    .createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 16);
}

// Round-11 bug-hunt fix: normalize email casing — see commit A.
const forgotPasswordSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .transform((s) => s.trim().toLowerCase()),
});

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

    // Rate limit on (ip, hashed-email) so a known email can't be locked
    // out by a single attacker, and a single IP can't spam many emails.
    // Each key gets 3 attempts/hour. Email-only keying (the previous
    // behavior) let an attacker DoS password recovery for any victim by
    // hitting the endpoint with that email a few times. The email is
    // hashed before composing the key so raw PII never enters the
    // limiter's storage — relevant if the in-memory limiter is ever
    // swapped for Redis.
    const ip = clientIpFromRequest(req) ?? "unknown";
    const rateLimitResult = rateLimit({
      key: `forgot-password:${ip}:${rateLimitEmailKey(email)}`,
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

    // Refuse to proceed if we can't build a valid recovery URL
    // (production missing AUTH_URL / NEXT_PUBLIC_URL / NEXTAUTH_URL /
    // VERCEL_URL). Bail before the user lookup so the failure shape is
    // identical regardless of email validity. Uses the unified strict
    // env resolver so this route's URL semantics match
    // notify-advisor.ts and any future caller composing outbound links.
    const baseUrl = getPublicAppUrlStrict();
    if (!baseUrl) {
      console.error(
        "forgot-password: no public app URL configured; refusing to send reset email"
      );
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
    // Round-11 commit 2.4b: column dropped; only emailCiphertext is
    // stored. The reset-link send already uses form-input plaintext.
    const user = await findUserByEmail(email, {
      where: { deletedAt: null },
      select: { id: true, emailCiphertext: true, role: true },
    });

    // Round-11 commit 3 (BRD §5.1.AUTH): clients (role=USER) authenticate
    // via magic link only — they don't have passwords to reset. Blank the
    // user reference for clients so the rest of the route falls into the
    // enumeration-safe "no such email" branch (same generic 200 response,
    // no reset email sent). The audit row still records the attempt with
    // metadata.userExists=false so a real audit reader can reconstruct
    // intent without exposing the role.
    const eligibleForPasswordReset =
      user && user.role !== "USER";

    // Audit BEFORE the response on every branch so the audit-write latency
    // is constant regardless of whether the email exists. If we deferred the
    // user-not-found audit to a void helper (like issueResetEmail), the two
    // branches would have asymmetric latency and the round-6 enumeration
    // mitigation would partially regress via DB-write timing.
    await writeAudit({
      // Round-11 commit 2.4a: when the user row is found, pass
      // emailCiphertext (writeAudit decrypts internally for the hash);
      // when not found we still hash the form-input plaintext so the
      // user-not-found and user-found code paths produce the same
      // actorEmailHash for a given email.
      actor: user
        ? { userId: user.id, emailCiphertext: user.emailCiphertext }
        : { userId: null, email },
      action: AUDIT_ACTIONS.AUTH_PASSWORD_RESET_REQUESTED,
      entityType: "User",
      entityId: user?.id ?? null,
      metadata: {
        userExists: Boolean(user),
        // Round-11 commit 3: capture the client-blocked branch so the
        // audit log distinguishes "client tried to reset password" from
        // "no such email" without exposing the role to the client.
        clientBlocked: user?.role === "USER",
      },
      request: req,
    });

    // Email enumeration mitigation has two pieces:
    //   1. Same response body for existing/non-existing emails (below).
    //   2. Move the slow path (token persistence + email send) off the
    //      response timeline. We `void` the helper instead of awaiting so
    //      the response returns in DB-lookup time regardless of whether we
    //      have work to do. Previously the known-email branch waited on a
    //      Resend round-trip (~100–500ms) while the unknown branch
    //      returned in ~5ms — a measurable side-channel.
    if (eligibleForPasswordReset) {
      // Round-11 commit 2.4a: send to the form-input plaintext rather
      // than user.email — the column may be null for users created
      // post-2.4a.
      void issueResetEmail(email, baseUrl);
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
