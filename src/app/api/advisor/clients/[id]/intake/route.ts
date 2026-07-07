import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/mobile/token";
import { getAssignedClientIntake } from "@/lib/mobile/advisor";
import { getMobileIntakeQuestions } from "@/lib/mobile/intake-script";

/** GET /api/advisor/clients/:id/intake — read-only transcript (plan §4.3). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "ADVISOR") {
    return NextResponse.json({ error: "Advisor access required" }, { status: 403 });
  }

  const { id: clientId } = await params;
  const result = await getAssignedClientIntake(user.id, clientId);
  if (!result) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const { client, interview } = result;
  const responses = (interview?.responses ?? []).map((r) => {
    const isVoice = !r.textResponse && Boolean(r.audioUrl);
    return {
      questionId: r.questionId,
      mode: isVoice ? "VOICE" : "TYPE",
      text: r.textResponse,
      // Presence marker only — playback uses the dedicated signed-URL endpoint.
      audioUrl: r.audioUrl ? "stored" : null,
      transcript: r.transcription,
      transcriptionStatus: r.transcriptionStatus,
      updatedAt: r.updatedAt.toISOString(),
    };
  });

  return NextResponse.json({
    client: {
      id: client.id,
      name: client.name,
      email: client.email,
      intakeStatus: interview?.status ?? "NOT_STARTED",
      submittedAt: interview?.submittedAt?.toISOString() ?? null,
      interviewId: interview?.id ?? null,
    },
    questions: getMobileIntakeQuestions(),
    responses,
  });
}
