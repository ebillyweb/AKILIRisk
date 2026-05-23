import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import { issueMagicLinkToken } from "@/lib/auth/magic-link";
import { isTestAuthEnabled } from "@/lib/auth/test-auth-enabled";

/**
 * Round-11 session-2 (Playwright client-smoke regression fix):
 * test-only magic-link issuance endpoint.
 *
 * POST /api/test/magic-link/issue
 *   Body: { email: string }
 *   Returns: { rawToken, verifyUrl, expires }
 *
 * Exists only so Playwright client smokes can drive the real magic-link
 * flow end-to-end. The production /api/auth/magic-link/request endpoint
 * deliberately does NOT return the raw token (it goes only into the
 * email body); test code can't recover it from the DB either (only the
 * SHA-256 hash is stored). This endpoint exposes the raw token to the
 * caller — strictly a test-only affordance.
 *
 * Gated by isTestAuthEnabled() — see src/lib/auth/test-auth-enabled.ts.
 * Requires ENABLE_TEST_AUTH=1; blocks Vercel Production; allows local dev
 * and Vercel Preview (Next.js runs NODE_ENV=production on Preview too).
 *
 * Audit row: writes AUTH_MAGIC_LINK_REQUEST with metadata.testOrigin:
 * true so admins reading the audit log can filter smoke-test issuances
 * out of compliance reviews. Also logs to console so a human watching
 * server output in dev knows the test path ran.
 *
 * See .env.example for the ENABLE_TEST_AUTH doc block.
 */

// Round-11 bug-hunt fix: normalize email casing to mirror the
// production /api/auth/magic-link/request schema. Without this the
// test endpoint can issue a token for "Alice@Example.com" while the
// production token issued for "alice@example.com" hits a different
// ciphertext lookup — Playwright smokes that mix cases would diverge
// from real-user behavior.
const requestSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .transform((s) => s.trim().toLowerCase()),
});

function resolvePublicBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_URL?.trim();
  if (configured) return configured;
  return "http://localhost:3000";
}

export async function POST(req: NextRequest) {
  if (!isTestAuthEnabled()) {
    // 404 (not 401/403) — same shape as any unmapped route. The endpoint's
    // very existence is a test-only affordance; in production it does not
    // exist as far as any external caller is concerned.
    return new NextResponse(null, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const validation = requestSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { email } = validation.data;

  // Reuse the production helper — same code path that the real
  // /api/auth/magic-link/request route uses. The only difference here
  // is that we return the raw token in the response body.
  const issued = await issueMagicLinkToken(email);
  const verifyUrl = `${resolvePublicBaseUrl()}/auth/magic-link/verify?token=${issued.rawToken}`;

  console.warn(
    `[test-auth] issued magic-link token for email-hash=${email.slice(0, 4)}... (test-origin)`
  );

  // Single source of truth: same audit action as the production
  // request endpoint. The metadata.testOrigin flag is the
  // discriminator for compliance reviews.
  await writeAudit({
    actor: { userId: null, email },
    action: AUDIT_ACTIONS.AUTH_MAGIC_LINK_REQUEST,
    entityType: "User",
    entityId: null,
    metadata: {
      testOrigin: true,
      tokenId: issued.tokenId,
      route: "/api/test/magic-link/issue",
    },
    request: req,
  });

  return NextResponse.json({
    rawToken: issued.rawToken,
    verifyUrl,
    expires: issued.expires.toISOString(),
  });
}
