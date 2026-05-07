import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendMagicLinkEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { clientIpFromRequest } from "@/lib/request-ip";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import {
  issueMagicLinkToken,
  invalidatePriorMagicLinkTokens,
} from "@/lib/auth/magic-link";
import { findUserByEmail } from "@/lib/auth/user-email";

/**
 * Round-11 commit 2 (BRD §5.1.AUTH): magic-link issuance endpoint.
 *
 * POST /api/auth/magic-link/request {email}
 *
 * Mirrors the forgot-password pattern: rate-limited per (ip, email),
 * audited BEFORE responding for constant-time, generic 200 response so
 * the email-existence side-channel is closed, slow path void-fired off
 * the response timeline.
 *
 * Edge cases:
 *   - Email matches an active User: issue + email.
 *   - Email matches an active InviteCode but no User yet: issue with
 *     inviteCodeId set; commit 4 wires the User-creation logic at consume
 *     time. For commit 2 the consume path rejects (no user); the audit
 *     trail still records the request.
 *   - Email matches neither: silent success (enumeration-safe).
 */

// Round-11 bug-hunt fix: normalize email casing so the deterministic
// ciphertext lookup (case-sensitive) matches whatever case the user
// originally signed up with. Same transform applies at every other
// auth entry point — see commit A's diff for the full sweep.
const requestSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .transform((s) => s.trim().toLowerCase()),
});

function resolvePublicBaseUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_URL?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    console.error(
      "NEXT_PUBLIC_URL is not configured; refusing to send magic-link email with localhost link"
    );
    return null;
  }
  return "http://localhost:3000";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { email } = validation.data;

    // Rate limit: per (ip, email), 3 attempts per hour. Mirrors the
    // forgot-password flow — see notes there for why per-(ip,email)
    // beats per-email-only.
    const ip = clientIpFromRequest(req) ?? "unknown";
    const rateLimitResult = rateLimit({
      key: `magic-link-request:${ip}:${email}`,
      limit: 3,
      windowMs: 60 * 60 * 1000,
    });
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many sign-in requests. Please try again later.",
          resetAt: new Date(rateLimitResult.resetAt).toISOString(),
        },
        { status: 429 }
      );
    }

    const baseUrl = resolvePublicBaseUrl();
    if (!baseUrl) {
      return NextResponse.json(
        { error: "Sign-in is temporarily unavailable" },
        { status: 503 }
      );
    }

    // Lookup user + invite-code in parallel to keep the audit-write
    // latency constant regardless of which (if any) match. Both are
    // bounded reads.
    // Round-11 commit 2.4b: User.email column dropped; pull
    // emailCiphertext for the audit hash. InviteCode.prefillEmail
    // is unrelated and stays plaintext (separate scope).
    const [user, inviteCode] = await Promise.all([
      findUserByEmail(email, {
        where: { deletedAt: null },
        select: { id: true, emailCiphertext: true },
      }),
      prisma.inviteCode.findFirst({
        where: {
          prefillEmail: email,
          // Invite is "active" if not yet expired (or has no expiry) +
          // hasn't already been fully consumed.
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        select: { id: true },
      }),
    ]);

    // Audit BEFORE the response on every branch so the audit-write
    // latency is constant regardless of whether the email matches.
    // Round-11 commit 2.4b: pass emailCiphertext for the user-found
    // branch (writeAudit decrypts internally for the hash); fall back
    // to form-input plaintext when no user matches.
    await writeAudit({
      actor: user
        ? { userId: user.id, emailCiphertext: user.emailCiphertext }
        : { userId: null, email },
      action: AUDIT_ACTIONS.AUTH_MAGIC_LINK_REQUEST,
      entityType: "User",
      entityId: user?.id ?? null,
      metadata: {
        userExists: Boolean(user),
        inviteCodeMatched: Boolean(inviteCode),
      },
      request: req,
    });

    // Off-the-response-timeline issuance + email send. Same
    // enumeration-safety reasoning as forgot-password.
    if (user || inviteCode) {
      void issueMagicLinkInBackground(
        email,
        baseUrl,
        inviteCode?.id ?? null
      );
    }

    return NextResponse.json(
      {
        message:
          "If an account exists for that email, a sign-in link has been sent.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Magic-link request error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

async function issueMagicLinkInBackground(
  email: string,
  baseUrl: string,
  inviteCodeId: string | null
): Promise<void> {
  try {
    // Invalidate any prior unexpired tokens for this email so a fresh
    // request supersedes an in-flight one. Mirrors forgot-password.
    await invalidatePriorMagicLinkTokens(email);

    const issued = await issueMagicLinkToken(email, { inviteCodeId });

    const verifyUrl = `${baseUrl}/auth/magic-link/verify?token=${issued.rawToken}`;
    await sendMagicLinkEmail(email, verifyUrl);
  } catch (e) {
    console.error("Background magic-link issuance failed:", e);
  }
}
