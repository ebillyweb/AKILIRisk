import { formatIntakeStructuredAnswerForDisplay } from "@/lib/intake/intake-answer-behavior";

export type IntakeAnswerKind =
  | "missing"
  | "typed"
  | "structured_choice"
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

export type IntakeAnswerQuestionLike = {
  answerType: string;
  answer0?: string | null;
  answer1?: string | null;
  answer2?: string | null;
  answer3?: string | null;
  options?: unknown;
};

function resolveStructuredAnswerText(
  question: IntakeAnswerQuestionLike | undefined,
  storedValue: string,
): { text: string; isStructuredChoice: boolean } {
  if (!question) {
    return { text: storedValue, isStructuredChoice: false };
  }

  const resolved =
    formatIntakeStructuredAnswerForDisplay(question, storedValue) ?? storedValue;
  return {
    text: resolved,
    isStructuredChoice: resolved !== storedValue,
  };
}

/** Formats a client intake response for read-only display (web + PDF). */
export function formatIntakeAnswerDisplay(
  response: IntakeResponseLike | undefined,
  question?: IntakeAnswerQuestionLike,
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
    const raw = response.transcription.trim();
    const { text, isStructuredChoice } = resolveStructuredAnswerText(question, raw);

    return {
      answerText: text,
      answerKind: hasTypedAnswer
        ? isStructuredChoice
          ? "structured_choice"
          : "typed"
        : "voice_transcript",
      answerLabel: hasTypedAnswer
        ? isStructuredChoice
          ? "Selected option"
          : "Typed answer"
        : "Voice recording (transcript)",
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
