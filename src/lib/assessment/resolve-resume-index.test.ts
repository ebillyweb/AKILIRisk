import { describe, expect, it } from "vitest";
import {
  firstUnansweredQuestionIndex,
  lastUnansweredQuestionIndex,
  resolveResumeQuestionIndex,
  resolveResumePillarSlug,
  shouldShowSkipToLastUnanswered,
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

describe("lastUnansweredQuestionIndex", () => {
  it("returns the furthest unanswered visible question", () => {
    expect(
      lastUnansweredQuestionIndex(
        questions,
        { q0: 1, q1: undefined, q2: 2 },
        [],
      ),
    ).toBe(1);
  });

  it("returns null when every question is answered", () => {
    expect(
      lastUnansweredQuestionIndex(questions, { q0: 1, q1: 2, q2: 0 }, []),
    ).toBeNull();
  });
});

describe("shouldShowSkipToLastUnanswered", () => {
  it("offers skip when viewing an earlier question than the last gap", () => {
    expect(
      shouldShowSkipToLastUnanswered(
        0,
        questions,
        { q0: 1, q1: undefined, q2: 2 },
        [],
      ),
    ).toEqual({ show: true, targetIndex: 1 });
  });

  it("hides skip when already on the last unanswered question", () => {
    expect(
      shouldShowSkipToLastUnanswered(
        1,
        questions,
        { q0: 1, q1: undefined, q2: 2 },
        [],
      ),
    ).toEqual({ show: false, targetIndex: 1 });
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
