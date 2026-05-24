import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isTestAuthEnabled } from "@/lib/auth/test-auth-enabled";
import { completeAssessmentForE2E } from "@/lib/test/complete-assessment-for-e2e";

/**
 * Test-only: score all six pillars for a client (Epic 5.2 Playwright).
 *
 * POST /api/test/assessment/prepare
 *   Body: { clientEmail, reset?: boolean, maturityAnswer?: number }
 *   Returns: { userId, clientId, assessmentId, status, draftReportId, pillarsScored }
 *
 * Gated by ENABLE_TEST_AUTH=1.
 */

const requestSchema = z.object({
  clientEmail: z
    .string()
    .email()
    .transform((s) => s.trim().toLowerCase()),
  reset: z.boolean().optional().default(true),
  maturityAnswer: z.number().int().min(0).max(3).optional(),
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

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await completeAssessmentForE2E(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Prepare failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
