import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdvisorHubNavRole } from "@/lib/auth-roles";
import {
  verifyMFAToken,
  verifyRecoveryCode,
  disableMFA,
} from "@/lib/mfa";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";

/**
 * Disable MFA for the current user.
 *
 * Requires re-authentication with a current TOTP code OR an unused recovery
 * code — disabling a second factor is a sensitive operation, so possession of
 * the authenticator (or a recovery code) must be proven first. On success the
 * secret, recovery codes, and enabled flag are cleared and all session rows are
 * dropped (see disableMFA), so the next JWT refresh recomputes a clean,
 * unchallenged state.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // MFA is for credential-based advisor/admin accounts only.
    if (!isAdvisorHubNavRole(session.user.role)) {
      return NextResponse.json(
        { error: "MFA is not available for this account type" },
        { status: 403 }
      );
    }

    // Rate limit re-auth attempts (same budget as the challenge routes).
    const rateLimitResult = rateLimit({
      key: `mfa-disable:${session.user.id}`,
      limit: 5,
      windowMs: 5 * 60 * 1000,
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many attempts. Please try again later.",
          resetAt: rateLimitResult.resetAt,
        },
        { status: 429 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { mfaEnabled: true },
    });

    if (!user?.mfaEnabled) {
      return NextResponse.json(
        { error: "MFA is not enabled on this account" },
        { status: 409 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { token, recoveryCode } = body as {
      token?: unknown;
      recoveryCode?: unknown;
    };

    let reauthenticated = false;
    if (typeof token === "string" && token.length > 0) {
      reauthenticated = await verifyMFAToken(session.user.id, token);
    } else if (typeof recoveryCode === "string" && recoveryCode.length > 0) {
      reauthenticated = await verifyRecoveryCode(session.user.id, recoveryCode);
    } else {
      return NextResponse.json(
        { error: "A current authenticator code or recovery code is required" },
        { status: 400 }
      );
    }

    if (!reauthenticated) {
      // Raw codes are NEVER logged — only the failure reason.
      await writeAudit({
        actor: {
          userId: session.user.id,
          role: session.user.role,
          email: session.user.email,
        },
        action: AUDIT_ACTIONS.AUTH_MFA_CHALLENGE_FAILURE,
        entityType: "User",
        entityId: session.user.id,
        metadata: { reason: "disable_reauth_failed" },
        request: req,
      });
      return NextResponse.json(
        { error: "Invalid code. MFA was not disabled." },
        { status: 400 }
      );
    }

    await disableMFA(session.user.id);

    await writeAudit({
      actor: {
        userId: session.user.id,
        role: session.user.role,
        email: session.user.email,
      },
      action: AUDIT_ACTIONS.AUTH_MFA_DISABLED,
      entityType: "User",
      entityId: session.user.id,
      beforeData: { mfaEnabled: true },
      afterData: { mfaEnabled: false },
      request: req,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("MFA disable error:", error);
    return NextResponse.json(
      { error: "Failed to disable MFA" },
      { status: 500 }
    );
  }
}
