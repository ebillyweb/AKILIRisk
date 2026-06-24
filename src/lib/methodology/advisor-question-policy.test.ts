import { describe, expect, it } from "vitest";
import { AdvisorQuestionSource } from "@prisma/client";
import {
  canDeleteAdvisorQuestion,
  deleteAdvisorQuestionError,
  isPlatformAdvisorQuestion,
  nextDisplayOrder,
} from "@/lib/methodology/advisor-question-policy";

describe("advisor-question-policy", () => {
  it("treats PLATFORM rows as non-deletable base questions", () => {
    expect(isPlatformAdvisorQuestion(AdvisorQuestionSource.PLATFORM)).toBe(true);
    expect(canDeleteAdvisorQuestion(AdvisorQuestionSource.PLATFORM)).toBe(false);
    expect(deleteAdvisorQuestionError()).toMatch(/cannot be deleted/i);
  });

  it("allows deleting CUSTOM rows only", () => {
    expect(canDeleteAdvisorQuestion(AdvisorQuestionSource.CUSTOM)).toBe(true);
  });

  it("computes next display order after siblings", () => {
    expect(nextDisplayOrder([])).toBe(0);
    expect(nextDisplayOrder([{ displayOrder: 0 }, { displayOrder: 5 }])).toBe(6);
  });
});
