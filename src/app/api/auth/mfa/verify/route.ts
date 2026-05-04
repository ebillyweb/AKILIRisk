import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { verifyMFAToken, enableMFA } from "@/lib/mfa";
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

    // Rate limiting: 5 attempts per 5 minutes
    const rateLimitKey = `mfa-verify:${session.user.id}`;
    const rateLimitResult = rateLimit({
      key: rateLimitKey,
      limit: 5,
      windowMs: 5 * 60 * 1000,
    });

    if (!rateLimitResult.success) {
      // Audit the rate-limit rejection. The TOTP token isn't even read on
      // this branch, so there's nothing to leak in metadata.
      await writeAudit({
        actor: {
          userId: session.user.id,
          role: session.user.role,
          email: session.user.email,
        },
        action: AUDIT_ACTIONS.AUTH_MFA_CHALLENGE_FAILURE,
        entityType: "User",
        entityId: session.user.id,
        metadata: { reason: "rate_limited" },
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
    const { token, action } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "TOTP token is required" },
        { status: 400 }
      );
    }

    if (action === "enable") {
      // Enable MFA and return recovery codes
      const recoveryCodes = await enableMFA(session.user.id, token);

      // Audit success. Raw recovery codes are NEVER in the payload — only
      // their count. The codes themselves are encrypted at rest.
      await writeAudit({
        actor: {
          userId: session.user.id,
          role: session.user.role,
          email: session.user.email,
        },
        action: AUDIT_ACTIONS.AUTH_MFA_ENROLLED,
        entityType: "User",
        entityId: session.user.id,
        beforeData: { mfaEnabled: false },
        afterData: { mfaEnabled: true },
        metadata: { recoveryCodeCount: recoveryCodes.length },
        request: req,
      });

      return NextResponse.json({
        success: true,
        recoveryCodes,
      });
    } else if (action === "login") {
      // Verify TOTP for login
      const isValid = await verifyMFAToken(session.user.id, token);

      if (!isValid) {
        // Audit invalid-TOTP failure. The raw TOTP code is NEVER in the
        // metadata — only the failure reason. (Brief: "never log raw TOTP codes".)
        await writeAudit({
          actor: {
            userId: session.user.id,
            role: session.user.role,
            email: session.user.email,
          },
          action: AUDIT_ACTIONS.AUTH_MFA_CHALLENGE_FAILURE,
          entityType: "User",
          entityId: session.user.id,
          metadata: { reason: "invalid_code" },
          request: req,
        });
        return NextResponse.json(
          { error: "Invalid TOTP code" },
          { status: 400 }
        );
      }

      // Mark session as MFA verified
      // Create or update database session for MFA tracking
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

      // Audit MFA-challenge success.
      await writeAudit({
        actor: {
          userId: session.user.id,
          role: session.user.role,
          email: session.user.email,
        },
        action: AUDIT_ACTIONS.AUTH_MFA_CHALLENGE_SUCCESS,
        entityType: "User",
        entityId: session.user.id,
        request: req,
      });

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: "Invalid action. Must be 'enable' or 'login'" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("MFA verification error:", error);

    // Handle specific error messages
    if (error instanceof Error && error.message === "Invalid TOTP token") {
      return NextResponse.json(
        { error: "Invalid TOTP code" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to verify MFA" },
      { status: 500 }
    );
  }
}
