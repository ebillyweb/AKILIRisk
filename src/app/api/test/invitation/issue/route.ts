import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { findUserByEmail } from "@/lib/auth/user-email";
import { isTestAuthEnabled } from "@/lib/auth/test-auth-enabled";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import { createAdvisorInvitation } from "@/lib/invitations/service";
import { buildDefaultInvitationPersonalMessage } from "@/lib/schemas/invitation";
import {
  getSubscriptionFeatures,
  STARTER_SUBSCRIPTION_FEATURES,
} from "@/lib/subscription/validation";

/**
 * Test-only invitation issuance for Playwright (Epic 5.1).
 *
 * POST /api/test/invitation/issue
 *   Body: { advisorEmail?, clientEmail, clientName?, intakeWaived? }
 *   Returns: { invitationId, url, clientEmail, status, intakeWaived }
 *
 * Gated by isTestAuthEnabled() — see src/lib/auth/test-auth-enabled.ts.
 */

const requestSchema = z.object({
  advisorEmail: z
    .string()
    .email()
    .optional()
    .default("advisor@test.com")
    .transform((s) => s.trim().toLowerCase()),
  clientEmail: z
    .string()
    .email()
    .transform((s) => s.trim().toLowerCase()),
  clientName: z.string().max(100).optional(),
  intakeWaived: z.boolean().optional().default(false),
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

  const { advisorEmail, clientEmail, clientName, intakeWaived } = validation.data;

  const advisorUser = await findUserByEmail(advisorEmail, {
    where: { deletedAt: null },
    select: { id: true, role: true },
  });

  if (!advisorUser || advisorUser.role !== "ADVISOR") {
    return NextResponse.json(
      { error: "Advisor account not found for advisorEmail" },
      { status: 404 }
    );
  }

  const profile = await prisma.advisorProfile.findUnique({
    where: { userId: advisorUser.id },
    select: { id: true, firmName: true },
  });

  if (!profile) {
    return NextResponse.json(
      { error: "Advisor profile not found" },
      { status: 404 }
    );
  }

  const features =
    (await getSubscriptionFeatures(advisorUser.id)) ??
    STARTER_SUBSCRIPTION_FEATURES;

  try {
    const invitation = await createAdvisorInvitation(
      profile.id,
      {
        clientEmail,
        clientName,
        personalMessage: buildDefaultInvitationPersonalMessage(profile.firmName),
        intakeWaived,
      },
      {
        subscriptionFeatures: {
          customSubdomainEnabled: features.customSubdomainEnabled,
        },
      }
    );

    console.warn(
      `[test-auth] issued invitation ${invitation.id} for client ${clientEmail.slice(0, 4)}... (test-origin)`
    );

    await writeAudit({
      actor: { userId: advisorUser.id, email: advisorEmail },
      action: AUDIT_ACTIONS.INVITE_SEND,
      entityType: "InviteCode",
      entityId: invitation.id,
      metadata: {
        testOrigin: true,
        route: "/api/test/invitation/issue",
        clientEmail,
        intakeWaived,
      },
      request: req,
    });

    return NextResponse.json({
      invitationId: invitation.id,
      url: invitation.url,
      clientEmail,
      status: invitation.status,
      intakeWaived: invitation.intakeWaived ?? false,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create invitation";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
