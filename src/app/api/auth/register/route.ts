import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import {
  assertCanAddClientForAdvisorProfile,
  ClientLimitError,
} from "@/lib/billing/subscription-service";
import { prisma } from "@/lib/db";
import { verifyInviteToken, consumeInviteCode } from "@/lib/invite";
import { triggerRegistrationNotification } from "@/lib/notifications/triggers";
import { logSafeError } from "@/lib/log-safe-error";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";

const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character"
    ),
  inviteToken: z.string().optional(),
  name: z.string().max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Round-11 commit 3 (BRD §5.1.AUTH): client signup via password
    // is removed. Clients are created by advisor invitation; the
    // invitation flow issues a magic link, and the magic-link verify
    // path creates the User row on first click (commit 4 wires this).
    // This endpoint refuses with a fixed 410 Gone so any cached client
    // pointing here gets a clear "ask your advisor" message rather
    // than a confusing validation error. Advisor + admin accounts are
    // created via /admin/advisors/new; not affected.
    return NextResponse.json(
      {
        error:
          "Client signup via password is no longer supported. Ask your advisor to send you a sign-in link.",
      },
      { status: 410 }
    );

    // Pre-round-11 implementation kept below for reference — never
    // executes after the early return above. Will be removed once
    // commit 4 lands the magic-link-driven user creation.
    // eslint-disable-next-line no-unreachable
    const body = await request.json();

    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { email, password, inviteToken, name } = validation.data;

    // Require valid invite token to create an account
    if (!inviteToken) {
      return NextResponse.json(
        { error: "Invite code required. Start from the assessment link and enter your invite code." },
        { status: 400 }
      );
    }
    const inviteCodeId = verifyInviteToken(inviteToken);
    if (!inviteCodeId) {
      return NextResponse.json(
        { error: "Invalid or expired invite. Please request a new link and enter your invite code again." },
        { status: 400 }
      );
    }

    // Check if user already exists.
    //
    // Intentional: this lookup does NOT filter `deletedAt: null`. A
    // soft-deleted account permanently blocks re-registration under the
    // same email. We retain that audit trail and prevent identity reuse;
    // an admin must hard-delete or merge accounts to free the email.
    // If you're tempted to "fix" this by adding the filter, talk to
    // someone who knows the policy first.
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Unable to create account" },
        { status: 409 }
      );
    }

    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(password, 12);

    // Look up the invitation to check if it was created by an advisor
    const inviteCode = await prisma.inviteCode.findUnique({
      where: { id: inviteCodeId },
      select: { createdBy: true, clientName: true, intakeWaived: true }
    });

    if (!inviteCode) {
      return NextResponse.json(
        { error: "Invalid invitation" },
        { status: 400 }
      );
    }

    // Determine the name to use
    const userName = name || inviteCode.clientName || undefined;

    // Use transaction to create user and link to advisor if invitation has createdBy
    const result = await prisma.$transaction(async (tx) => {

      // Create user (this form only creates USER role; advisors/admins are set up separately)
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          role: "USER",
          name: userName,
        },
        select: {
          id: true,
          email: true,
        },
      });

      // If this is an advisor-initiated invitation, create the client-advisor relationship
      if (inviteCode.createdBy) {
        await assertCanAddClientForAdvisorProfile(inviteCode.createdBy, tx);

        // Create ClientProfile for the new user
        await tx.clientProfile.create({
          data: {
            userId: user.id,
          },
        });

        // Create ClientAdvisorAssignment linking the new client to the advisor
        await tx.clientAdvisorAssignment.create({
          data: {
            clientId: user.id,
            advisorId: inviteCode.createdBy,
            ...(inviteCode.intakeWaived ? { intakeWaivedAt: new Date(), intakeWaivedByAdvisorId: inviteCode.createdBy } : {}),
          },
        });

        // Update invitation status to REGISTERED
        await tx.inviteCode.update({
          where: { id: inviteCodeId },
          data: {
            status: "REGISTERED",
            statusUpdatedAt: new Date(),
          },
        });
      }

      // Consume the invite code (increment usage count)
      await tx.inviteCode.update({
        where: { id: inviteCodeId },
        data: { usedCount: { increment: 1 } },
      });

      return user;
    });

    const user = result;

    // Self-audit: the new user is the actor. Captures which invite code was
    // consumed (auditable: "did this signup come through advisor X's invite?").
    // Password and rawToken are never in the payload — they exist only above
    // the create scope. Email is hashed by the redactor on persist.
    await writeAudit({
      actor: { userId: user.id, role: "USER", email: user.email },
      action: AUDIT_ACTIONS.AUTH_REGISTER,
      entityType: "User",
      entityId: user.id,
      beforeData: null,
      afterData: { role: "USER" },
      metadata: {
        viaInviteCodeId: inviteCodeId,
        advisorInitiated: Boolean(inviteCode.createdBy),
      },
      request,
    });

    // Trigger registration notification if invite code was used (fire-and-forget)
    if (inviteCode.createdBy && user.id && userName && user.email) {
      void triggerRegistrationNotification(user.id, userName, user.email);
    }

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof ClientLimitError) {
      return NextResponse.json(
        {
          error: error.message,
          code: "CLIENT_LIMIT",
        },
        { status: 403 }
      );
    }
    // Use logSafeError so a Prisma P2002 (unique violation) doesn't dump
    // the colliding email value into application logs. See src/lib/log-safe-error.ts.
    logSafeError("auth/register", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
