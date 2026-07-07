import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isTestAuthEnabled } from "@/lib/auth/test-auth-enabled";
import { findUserByEmail } from "@/lib/auth/user-email";
import {
  inspectEnterpriseScenario,
  setupEnterpriseScenario,
  teardownEnterpriseScenario,
} from "@/lib/test/enterprise-e2e";

/**
 * POST /api/test/enterprise/prepare
 * Test-only enterprise asset-transfer fixtures (ENABLE_TEST_AUTH=1).
 *
 * Actions:
 * - setup: solo owner assets → provision firm → invite/accept member
 * - inspect: read enterprise + member clone state
 * - teardown: delete firm (requires admin actor email)
 */

const emailSchema = z
  .string()
  .email()
  .transform((s) => s.trim().toLowerCase());

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("setup"),
    ownerEmail: emailSchema,
    memberEmail: emailSchema,
    runId: z.string().min(1).max(40).optional(),
  }),
  z.object({
    action: z.literal("inspect"),
    enterpriseId: z.string().min(1),
    memberEmail: emailSchema,
  }),
  z.object({
    action: z.literal("teardown"),
    enterpriseId: z.string().min(1),
    slug: z.string().min(1),
    actorEmail: emailSchema,
  }),
]);

export async function POST(req: NextRequest) {
  if (!isTestAuthEnabled()) {
    return new NextResponse(null, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    switch (parsed.data.action) {
      case "setup":
        return NextResponse.json(await setupEnterpriseScenario(parsed.data));
      case "inspect":
        return NextResponse.json(
          await inspectEnterpriseScenario(parsed.data.enterpriseId, parsed.data.memberEmail),
        );
      case "teardown": {
        const actor = await findUserByEmail(parsed.data.actorEmail, { select: { id: true } });
        if (!actor?.id) {
          return NextResponse.json({ error: "Actor not found" }, { status: 404 });
        }
        await teardownEnterpriseScenario({
          enterpriseId: parsed.data.enterpriseId,
          slug: parsed.data.slug,
          actorUserId: actor.id,
        });
        return NextResponse.json({ ok: true });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Prepare failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
