import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isTestAuthEnabled } from "@/lib/auth/test-auth-enabled";
import { findUserByEmail } from "@/lib/auth/user-email";
import { prisma } from "@/lib/db";

const requestSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .transform((s) => s.trim().toLowerCase()),
  restoreOnly: z.boolean().optional().default(false),
});

const TEST_EMAIL_SUFFIX = "@test.com";

/**
 * Test-only soft-delete fixture (US-49 Playwright smokes).
 *
 * POST /api/test/user/deactivate { email, restoreOnly? }
 *   restoreOnly=true — clear User.deletedAt for the test account.
 *   default — set deletedAt (mirrors admin soft-delete).
 *
 * Restricted to *@test.com addresses. Gated by isTestAuthEnabled().
 */
export async function POST(req: NextRequest) {
  if (!isTestAuthEnabled()) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { email, restoreOnly } = parsed.data;

    if (!email.endsWith(TEST_EMAIL_SUFFIX)) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = await findUserByEmail(email, {
      select: { id: true },
    });

    if (!user?.id) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (restoreOnly) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          deletedAt: null,
          advisorPortalAccessEnabled: true,
        },
      });
      return NextResponse.json({ email, restored: true });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        deletedAt: new Date(),
        advisorPortalAccessEnabled: false,
      },
    });

    return NextResponse.json({ email, deactivated: true });
  } catch (error) {
    console.error("[test/user/deactivate] error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
