import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isTestAuthEnabled } from "@/lib/auth/test-auth-enabled";
import { prepareHouseholdProfilesForE2E } from "@/lib/test/household-profiles-e2e";

/**
 * Test-only: reset household profile state (Epic 5.3 Playwright).
 *
 * POST /api/test/household-profiles/prepare
 *   Body: { clientEmail, advisorEmail?, resetMembers?, householdProfilesEnabled? }
 *
 * Gated by ENABLE_TEST_AUTH=1.
 */

const requestSchema = z.object({
  clientEmail: z
    .string()
    .email()
    .transform((s) => s.trim().toLowerCase()),
  advisorEmail: z
    .string()
    .email()
    .transform((s) => s.trim().toLowerCase())
    .optional(),
  resetMembers: z.boolean().optional().default(true),
  householdProfilesEnabled: z.boolean().optional(),
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
      { status: 400 },
    );
  }

  try {
    const result = await prepareHouseholdProfilesForE2E(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Prepare failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
