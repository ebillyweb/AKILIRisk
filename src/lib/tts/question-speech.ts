import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOpenAIClient } from "@/lib/openai";
import {
  buildQuestionNarrationText,
  questionTtsBodySchema,
} from "@/lib/tts/question-tts-body";
import { mapQuestionTtsError } from "@/lib/tts/question-tts-errors";

export { buildQuestionNarrationText, questionTtsBodySchema } from "@/lib/tts/question-tts-body";
export type { QuestionTtsBody } from "@/lib/tts/question-tts-body";

const INTAKE_INSTRUCTIONS =
  "Speak in a calm, warm, polished voice with natural pauses. Read clearly and conversationally, like a thoughtful interviewer guiding a client through a confidential intake session.";

const ASSESSMENT_INSTRUCTIONS =
  "Speak in a calm, warm, polished voice with natural pauses. Read clearly and conversationally, like a thoughtful guide walking someone through a private risk assessment questionnaire.";

export async function synthesizeQuestionSpeech(
  narrationText: string,
  variant: "intake" | "assessment"
): Promise<Buffer> {
  const openai = getOpenAIClient();
  const speech = await openai.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice: "coral",
    input: narrationText,
    instructions:
      variant === "intake" ? INTAKE_INSTRUCTIONS : ASSESSMENT_INSTRUCTIONS,
    response_format: "mp3",
    speed: 0.95,
  });
  return Buffer.from(await speech.arrayBuffer());
}

export async function handleQuestionTtsRequest(
  request: NextRequest,
  variant: "intake" | "assessment"
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "OPENAI_API_KEY is not configured" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const parsed = questionTtsBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || "Invalid request",
        },
        { status: 400 }
      );
    }

    const narrationText = buildQuestionNarrationText(parsed.data);
    const audioBuffer = await synthesizeQuestionSpeech(narrationText, variant);

    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Question TTS error:", error);
    const mapped = mapQuestionTtsError(error);
    return NextResponse.json(
      { success: false, error: mapped.error },
      { status: mapped.status }
    );
  }
}
