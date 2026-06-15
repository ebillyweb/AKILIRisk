import { describe, expect, it } from "vitest";
import { formatIntakeAnswerDisplay } from "@/lib/pdf/intake/format-intake-answer";

describe("formatIntakeAnswerDisplay", () => {
  it("returns missing when no response", () => {
    expect(formatIntakeAnswerDisplay(undefined)).toEqual({
      answerText: "No response recorded for this question.",
      answerKind: "missing",
    });
  });

  it("labels typed answers", () => {
    const result = formatIntakeAnswerDisplay({
      transcription: "We meet quarterly.",
      audioUrl: null,
    });
    expect(result.answerKind).toBe("typed");
    expect(result.answerLabel).toBe("Typed answer");
    expect(result.answerText).toBe("We meet quarterly.");
  });

  it("labels voice transcripts", () => {
    const result = formatIntakeAnswerDisplay({
      transcription: "Recorded answer text.",
      audioUrl: "/api/intake/audio",
    });
    expect(result.answerKind).toBe("voice_transcript");
    expect(result.answerLabel).toBe("Voice recording (transcript)");
  });

  it("handles pending voice transcription", () => {
    const result = formatIntakeAnswerDisplay({
      transcription: null,
      audioUrl: "/api/intake/audio",
    });
    expect(result.answerKind).toBe("voice_pending");
    expect(result.answerLabel).toBe("Voice recording");
  });

  it("handles failed transcription", () => {
    const result = formatIntakeAnswerDisplay({
      transcription: null,
      audioUrl: "/api/intake/audio",
      transcriptionStatus: "FAILED",
    });
    expect(result.answerKind).toBe("transcription_failed");
  });
});
