import { NextRequest, NextResponse } from "next/server";
import { markInvitationOpened } from "@/lib/invitations/mark-opened";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invitationId } = await params;

    if (!invitationId) {
      return NextResponse.json(
        { error: "Invitation ID required" },
        { status: 400 }
      );
    }

    await markInvitationOpened(invitationId);

    // Return 200 OK regardless (don't expose invitation details)
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Invitation opened tracking error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}