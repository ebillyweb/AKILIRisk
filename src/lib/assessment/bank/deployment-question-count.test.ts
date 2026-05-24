import { describe, expect, it } from "vitest";
import { deploymentVisibleQuestionCount } from "./deployment-question-count";

describe("deploymentVisibleQuestionCount", () => {
  it("returns pillar visible count", () => {
    expect(
      deploymentVisibleQuestionCount({
        pillarVisibleCount: 179,
      }),
    ).toBe(179);
  });
});
