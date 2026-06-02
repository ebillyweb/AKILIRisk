import { describe, expect, it } from "vitest";

import { intakeResponsePlaybackUrl } from "./playback-url";

describe("intakeResponsePlaybackUrl", () => {
  it("builds the authenticated streaming path", () => {
    expect(
      intakeResponsePlaybackUrl("interview-1", "question-2"),
    ).toBe("/api/intake/interview-1/audio/question-2");
  });
});
