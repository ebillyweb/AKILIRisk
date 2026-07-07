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

  it("resolves choice_list stored values to option labels", () => {
    const result = formatIntakeAnswerDisplay(
      {
        transcription: "1",
        audioUrl: null,
      },
      {
        answerType: "choice_list",
        options: [
          { value: "0", label: "Retired" },
          { value: "1", label: "Employed" },
        ],
      },
    );
    expect(result.answerKind).toBe("structured_choice");
    expect(result.answerLabel).toBe("Selected option");
    expect(result.answerText).toBe("Employed");
  });

  it("leaves free-form text unchanged when no structured match exists", () => {
    const result = formatIntakeAnswerDisplay(
      {
        transcription: "We meet quarterly.",
        audioUrl: null,
      },
      {
        answerType: "choice_list",
        options: [
          { value: "0", label: "Retired" },
          { value: "1", label: "Employed" },
        ],
      },
    );
    expect(result.answerKind).toBe("typed");
    expect(result.answerText).toBe("We meet quarterly.");
  });
});
