import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { verifyRecoveryCode } from "@/lib/mfa";
import { rateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    // Require authenticated session
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Rate limiting: 5 attempts per 5 minutes (same as TOTP)
    const rateLimitKey = `mfa-recovery:${session.user.id}`;
    const rateLimitResult = rateLimit({
      key: rateLimitKey,
      limit: 5,
      windowMs: 5 * 60 * 1000,
    });

    if (!rateLimitResult.success) {
      // Recovery rate-limit failure shares the AUTH_MFA_CHALLENGE_FAILURE
      // action with TOTP rate-limit; metadata.reason distinguishes them so
      // a single filter shows all MFA challenge failures.
      await writeAudit({
        actor: {
          userId: session.user.id,
          role: session.user.role,
          email: session.user.email,
        },
        action: AUDIT_ACTIONS.AUTH_MFA_CHALLENGE_FAILURE,
        entityType: "User",
        entityId: session.user.id,
        metadata: { reason: "recovery_rate_limited" },
        request: req,
      });
      return NextResponse.json(
        {
          error: "Too many attempts. Please try again later.",
          resetAt: rateLimitResult.resetAt,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Recovery code is required" },
        { status: 400 }
      );
    }

    // Verify and consume recovery code
    const isValid = await verifyRecoveryCode(session.user.id, code);

    if (!isValid) {
      // Raw recovery code is NEVER in metadata — only the reason. Brief:
      // "never log raw … session tokens".
      await writeAudit({
        actor: {
          userId: session.user.id,
          role: session.user.role,
          email: session.user.email,
        },
        action: AUDIT_ACTIONS.AUTH_MFA_CHALLENGE_FAILURE,
        entityType: "User",
        entityId: session.user.id,
        metadata: { reason: "invalid_recovery_code" },
        request: req,
      });
      return NextResponse.json(
        { error: "Invalid or already used recovery code" },
        { status: 400 }
      );
    }

    // Mark session as MFA verified (same as TOTP)
    const existingSessions = await prisma.session.findMany({
      where: {
        userId: session.user.id,
        expires: { gt: new Date() },
      },
      orderBy: { expires: "desc" },
      take: 1,
    });

    if (existingSessions.length > 0) {
      // Update existing session
      await prisma.session.update({
        where: { id: existingSessions[0].id },
        data: { mfaVerified: true },
      });
    } else {
      // Create new session for MFA tracking (expires in 30 days)
      const sessionToken = crypto.randomBytes(32).toString("hex");
      await prisma.session.create({
        data: {
          sessionToken,
          userId: session.user.id,
          expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          mfaVerified: true,
        },
      });
    }

    // Get remaining recovery code count
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { mfaRecoveryCodes: true },
    });

    const remainingCodes = user?.mfaRecoveryCodes
      ? (user.mfaRecoveryCodes as string[]).length
      : 0;

    // Audit recovery-code success. The remaining count goes in metadata —
    // useful operationally ("user is running low on recovery codes"), no
    // sensitive value.
    await writeAudit({
      actor: {
        userId: session.user.id,
        role: session.user.role,
        email: session.user.email,
      },
      action: AUDIT_ACTIONS.AUTH_MFA_RECOVERY_USED,
      entityType: "User",
      entityId: session.user.id,
      metadata: { remainingRecoveryCodes: remainingCodes },
      request: req,
    });

    return NextResponse.json({
      success: true,
      remainingCodes,
    });
  } catch (error) {
    console.error("Recovery code verification error:", error);
    return NextResponse.json(
      { error: "Failed to verify recovery code" },
      { status: 500 }
    );
  }
}
