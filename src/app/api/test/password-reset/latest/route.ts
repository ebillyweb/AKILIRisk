import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { peekTestPasswordResetToken } from "@/lib/auth/password-reset-test-store";
import { isTestAuthEnabled } from "@/lib/auth/test-auth-enabled";

/**
 * Test-only password-reset token retrieval endpoint.
 *
 * POST /api/test/password-reset/latest
 *   Body: { email: string }
 *   Returns: { rawToken, resetUrl, expires }
 *
 * Returns the latest raw reset token captured when /api/auth/forgot-password
 * issued a reset link. Only the SHA-256 hash is persisted in the database, so
 * Playwright smokes cannot recover the token from the DB — this endpoint
 * exposes the raw token strictly for test automation.
 *
 * Because forgot-password sends email in a background task, callers may need
 * to poll briefly until a token appears.
 *
 * Gated by isTestAuthEnabled() — see src/lib/auth/test-auth-enabled.ts.
 */

const requestSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .transform((s) => s.trim().toLowerCase()),
});

export async function POST(req: NextRequest) {
  if (!isTestAuthEnabled()) {
    return new NextResponse(null, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = requestSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { email } = validation.data;
  const stored = peekTestPasswordResetToken(email);
  if (!stored) {
    return NextResponse.json(
      { error: "No active password reset token for this email" },
      { status: 404 }
    );
  }

  console.warn(
    `[test-auth] returned password-reset token for email-hash=${email.slice(0, 4)}... (test-origin)`
  );

  return NextResponse.json({
    rawToken: stored.rawToken,
    resetUrl: stored.resetUrl,
    expires: stored.expires.toISOString(),
  });
}
