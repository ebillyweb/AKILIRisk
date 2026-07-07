import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyCronSecretRequest } from "@/lib/cron/verify-cron-secret";
import { prisma } from "@/lib/db";
import { userEmailForDisplay } from "@/lib/auth/user-email";
import { finalizeEnterpriseProvision } from "@/lib/enterprise/finalize-enterprise-provision";

export const maxDuration = 300;

const bodySchema = z.object({
  actorUserId: z.string().cuid().nullable().optional(),
});

/**
 * Long-running enterprise provision worker. Triggered after admin create via
 * scheduleEnterpriseProvision() so work runs in a fresh serverless invocation.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> },
) {
  const authError = verifyCronSecretRequest(request.headers.get("Authorization"));
  if (authError) return authError;

  const { enterpriseId } = await params;

  let actorUserId: string | null | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    actorUserId = parsed.success ? parsed.data.actorUserId : undefined;
  } catch {
    actorUserId = undefined;
  }

  let actor: Parameters<typeof finalizeEnterpriseProvision>[1];
  if (actorUserId) {
    const user = await prisma.user.findUnique({
      where: { id: actorUserId },
      select: { id: true, emailCiphertext: true, role: true },
    });
    if (user) {
      actor = {
        userId: user.id,
        email: userEmailForDisplay(user),
        role: user.role,
      };
    }
  }

  const result = await finalizeEnterpriseProvision(enterpriseId, actor);

  if (!result.success && !result.skipped) {
    return NextResponse.json(
      {
        success: false,
        enterpriseId,
        error: result.error ?? "Provision finalize failed",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    enterpriseId,
    skipped: result.skipped ?? false,
    timestamp: new Date().toISOString(),
  });
}
