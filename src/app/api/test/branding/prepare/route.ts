import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isTestAuthEnabled } from "@/lib/auth/test-auth-enabled";
import { prepareBrandingForE2E } from "@/lib/test/branding-e2e";

/**
 * Test-only: snapshot or restore advisor branding fields for Playwright.
 *
 * POST /api/test/branding/prepare
 *   Body: { advisorEmail, restore?, ensureBrandingEnabled? }
 *
 * Gated by ENABLE_TEST_AUTH=1.
 */

const baselineSchema = z.object({
  tagline: z.string().nullable(),
  primaryColor: z.string().nullable(),
  secondaryColor: z.string().nullable(),
  accentColor: z.string().nullable(),
  brandingEnabled: z.boolean(),
});

const requestSchema = z.object({
  advisorEmail: z
    .string()
    .email()
    .transform((s) => s.trim().toLowerCase()),
  restore: baselineSchema.optional(),
  ensureBrandingEnabled: z.boolean().optional(),
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
    const result = await prepareBrandingForE2E(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Prepare failed";
    const status = message === "User not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
