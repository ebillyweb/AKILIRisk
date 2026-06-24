import { describe, expect, it } from "vitest";
import {
  firstUnansweredQuestionIndex,
  resolveResumeQuestionIndex,
  resolveResumePillarSlug,
} from "./resolve-resume-index";
import type { Question } from "./types";

const questions = [
  { id: "q0", type: "maturity-scale" },
  { id: "q1", type: "maturity-scale" },
  { id: "q2", type: "maturity-scale" },
] as Question[];

describe("resolveResumeQuestionIndex", () => {
  it("uses server pillar position when it matches", () => {
    expect(
      resolveResumeQuestionIndex("governance", {
        assessmentData: { currentPillar: "governance", currentQuestionIndex: 2 },
        visibleQuestions: questions,
        answers: { q0: 1, q1: 2 },
        skippedQuestions: [],
      }),
    ).toBe(2);
  });

  it("advances past an already-answered server index", () => {
    expect(
      resolveResumeQuestionIndex("governance", {
        assessmentData: { currentPillar: "governance", currentQuestionIndex: 1 },
        visibleQuestions: questions,
        answers: { q0: 1, q1: 2 },
        skippedQuestions: [],
      }),
    ).toBe(2);
  });

  it("falls back to first unanswered question in the pillar", () => {
    expect(
      resolveResumeQuestionIndex("governance", {
        assessmentData: { currentPillar: "cyber-digital", currentQuestionIndex: 4 },
        visibleQuestions: questions,
        answers: { q0: 1 },
        skippedQuestions: [],
      }),
    ).toBe(1);
  });
});

describe("firstUnansweredQuestionIndex", () => {
  it("returns last index when all questions are complete", () => {
    expect(
      firstUnansweredQuestionIndex(questions, { q0: 1, q1: 2, q2: 0 }, []),
    ).toBe(2);
  });
});

describe("resolveResumePillarSlug", () => {
  it("prefers in-progress pillar", () => {
    expect(
      resolveResumePillarSlug(
        [
          { slug: "governance", status: "completed" },
          { slug: "cyber-digital", status: "in-progress" },
        ],
        { currentPillar: "governance" },
        "governance",
      ),
    ).toBe("cyber-digital");
  });
});
