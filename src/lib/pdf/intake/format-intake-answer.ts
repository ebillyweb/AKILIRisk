export type IntakeAnswerKind =
  | "missing"
  | "typed"
  | "voice_transcript"
  | "voice_pending"
  | "transcription_failed";

export type IntakeAnswerDisplay = {
  answerText: string;
  answerKind: IntakeAnswerKind;
  /** Short label for PDF badges, e.g. "Voice recording" */
  answerLabel?: string;
};

type IntakeResponseLike = {
  audioUrl?: string | null;
  transcription?: string | null;
  transcriptionStatus?: string | null;
};

/** Formats a client intake response for read-only display (web + PDF). */
export function formatIntakeAnswerDisplay(
  response: IntakeResponseLike | undefined,
): IntakeAnswerDisplay {
  if (!response) {
    return {
      answerText: "No response recorded for this question.",
      answerKind: "missing",
    };
  }

  const hasVoiceRecording = Boolean(response.audioUrl);
  const hasTypedAnswer =
    Boolean(response.transcription?.trim()) && !hasVoiceRecording;

  if (response.transcriptionStatus === "FAILED") {
    return {
      answerText:
        response.transcription?.trim() ||
        "Transcription failed. Listen to the voice recording in the advisor portal.",
      answerKind: "transcription_failed",
      answerLabel: hasVoiceRecording ? "Voice recording (transcription failed)" : undefined,
    };
  }

  if (response.transcription?.trim()) {
    return {
      answerText: response.transcription.trim(),
      answerKind: hasTypedAnswer ? "typed" : "voice_transcript",
      answerLabel: hasTypedAnswer ? "Typed answer" : "Voice recording (transcript)",
    };
  }

  if (hasVoiceRecording) {
    return {
      answerText:
        "Voice recording submitted. Transcript pending or unavailable — listen in the advisor portal.",
      answerKind: "voice_pending",
      answerLabel: "Voice recording",
    };
  }

  return {
    answerText: "No transcript available.",
    answerKind: "missing",
  };
}
