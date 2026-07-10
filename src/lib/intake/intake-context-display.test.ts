import { describe, expect, it } from "vitest";

import {
  DEFAULT_INTAKE_INTERVIEW_CONTEXT,
  intakeContextForDisplay,
} from "./intake-context-display";

describe("intakeContextForDisplay", () => {
  it("returns authored coaching context", () => {
    expect(
      intakeContextForDisplay(
        "Personal enterprise refers to the interconnected people, assets, and legal entities in your life.",
      ),
    ).toBe(
      "Personal enterprise refers to the interconnected people, assets, and legal entities in your life.",
    );
  });

  it("hides the generic fallback prompt", () => {
    expect(intakeContextForDisplay(DEFAULT_INTAKE_INTERVIEW_CONTEXT)).toBeNull();
  });

  it("hides empty values", () => {
    expect(intakeContextForDisplay("   ")).toBeNull();
    expect(intakeContextForDisplay(null)).toBeNull();
  });
});
