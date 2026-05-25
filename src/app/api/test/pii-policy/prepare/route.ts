import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isTestAuthEnabled } from "@/lib/auth/test-auth-enabled";
import { ELIGIBLE_PII_FIELDS } from "@/lib/advisor/pii-policy";
import { preparePiiPolicyForE2E } from "@/lib/test/pii-policy-e2e";

/**
 * Test-only: set or restore advisor PII policy (US-50 Playwright).
 *
 * POST /api/test/pii-policy/prepare
 *   Body: { advisorEmail, fields?, restoreDefault? }
 *
 * Gated by ENABLE_TEST_AUTH=1.
 */

const eligibleFieldEnum = z.enum(
  ELIGIBLE_PII_FIELDS as unknown as [string, ...string[]]
);

const requestSchema = z
  .object({
    advisorEmail: z
      .string()
      .email()
      .transform((s) => s.trim().toLowerCase()),
    restoreDefault: z.boolean().optional(),
    fields: z.record(eligibleFieldEnum, z.boolean()).optional(),
  })
  .refine((v) => v.restoreDefault === true || v.fields !== undefined, {
    message: "Specify fields or restoreDefault.",
    path: ["restoreDefault"],
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
    const result = await preparePiiPolicyForE2E(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Prepare failed";
    const status =
      message === "Advisor user not found" || message === "Advisor profile not found"
        ? 404
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
