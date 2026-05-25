import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isTestAuthEnabled } from "@/lib/auth/test-auth-enabled";
import { ELIGIBLE_PII_FIELDS } from "@/lib/advisor/pii-policy";
import { prepareConsentForE2E } from "@/lib/test/consent-e2e";

/**
 * Test-only: reset or restore client PII consent state (US-51 Playwright).
 *
 * POST /api/test/consent/prepare
 *   Body: { clientEmail, resetPending?, restoreConsented?, setFieldVisibility? }
 *
 * Gated by ENABLE_TEST_AUTH=1.
 */

const eligibleFieldEnum = z.enum(
  ELIGIBLE_PII_FIELDS as unknown as [string, ...string[]]
);

const requestSchema = z
  .object({
    clientEmail: z
      .string()
      .email()
      .transform((s) => s.trim().toLowerCase()),
    resetPending: z.boolean().optional(),
    restoreConsented: z.boolean().optional(),
    setFieldVisibility: z
      .record(eligibleFieldEnum, z.boolean())
      .optional(),
  })
  .refine(
    (v) =>
      v.resetPending === true ||
      v.restoreConsented === true ||
      (v.setFieldVisibility !== undefined &&
        Object.keys(v.setFieldVisibility).length > 0),
    {
      message:
        "Specify resetPending, restoreConsented, or a non-empty setFieldVisibility.",
      path: ["resetPending"],
    }
  );

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
    const result = await prepareConsentForE2E(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Prepare failed";
    const status = message === "User not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
