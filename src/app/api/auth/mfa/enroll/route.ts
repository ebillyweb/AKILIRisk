import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdvisorHubNavRole } from "@/lib/auth-roles";
import { isMfaEnrollmentRequiredForUser } from "@/lib/auth/mfa-enforcement";
import { getMfaRequiredForAllRoles } from "@/lib/platform/mfa-policy";
import { prisma } from "@/lib/db";
import { enrollMFA } from "@/lib/mfa";

export async function POST(_req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const mfaRequiredForAllRoles = await getMfaRequiredForAllRoles();
    const mayEnroll =
      isAdvisorHubNavRole(session.user.role) ||
      isMfaEnrollmentRequiredForUser({
        role: session.user.role,
        mfaEnabled: Boolean(session.user.mfaEnabled),
        mfaRequiredForAllRoles,
      });

    if (!mayEnroll) {
      return NextResponse.json(
        { error: "MFA is not available for this account" },
        { status: 403 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { mfaEnabled: true },
    });

    if (user?.mfaEnabled) {
      return NextResponse.json(
        { error: "MFA is already enabled on this account" },
        { status: 409 }
      );
    }

    // Enroll user in MFA. Note: this only generates the QR code + secret;
    // mfaEnabled doesn't flip until the user completes the TOTP challenge
    // via /api/auth/mfa/verify with action=enable. The audit row for
    // AUTH_MFA_ENROLLED is written there, not here, so a user who abandons
    // setup without completing the challenge isn't recorded as enrolled.
    const { qrCodeUrl, secret } = await enrollMFA(session.user.id);

    return NextResponse.json({
      qrCodeUrl,
      secret, // For manual entry in authenticator app
    });
  } catch (error) {
    console.error("MFA enrollment error:", error);
    return NextResponse.json(
      { error: "Failed to enroll in MFA" },
      { status: 500 }
    );
  }
}
