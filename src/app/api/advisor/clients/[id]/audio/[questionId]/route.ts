import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/mobile/token";
import { getAssignedClientIntake } from "@/lib/mobile/advisor";
import { generateDownloadUrl } from "@/lib/documents/s3";
import { isOwnedIntakeAudioKey } from "@/lib/intake/audio-key";

/** GET /api/advisor/clients/:id/audio/:questionId — signed playback URL. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> },
) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "ADVISOR") {
    return NextResponse.json({ error: "Advisor access required" }, { status: 403 });
  }

  const { id: clientId, questionId } = await params;
  const result = await getAssignedClientIntake(user.id, clientId);
  if (!result?.interview) {
    return NextResponse.json({ error: "Client intake not found" }, { status: 404 });
  }

  const response = result.interview.responses.find((r) => r.questionId === questionId);
  if (!response?.audioUrl) {
    return NextResponse.json({ error: "No audio for this question" }, { status: 404 });
  }
  // Defense in depth: only ever sign a key inside this interview's namespace,
  // so a tampered audioUrl can't turn this endpoint into a bucket-wide reader.
  if (!isOwnedIntakeAudioKey(response.audioUrl, result.interview.id)) {
    return NextResponse.json({ error: "No audio for this question" }, { status: 404 });
  }

  try {
    const url = await generateDownloadUrl(response.audioUrl);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("audio playback url error:", error);
    return NextResponse.json({ error: "Could not load audio." }, { status: 500 });
  }
}
