import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { enrollMFA } from "@/lib/mfa";

export async function POST(_req: NextRequest) {
  try {
    // Require authenticated session
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Round-11 commit 3 (BRD §5.1.AUTH): MFA is for advisor + admin
    // accounts only. Clients use magic link and have no password to
    // protect with a second factor.
    if (session.user.role === "USER") {
      return NextResponse.json(
        { error: "MFA is not available for client accounts" },
        { status: 403 }
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
