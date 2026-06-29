import { describe, expect, it } from "vitest";

import {
  advisorAssessmentQuestionToWire,
  buildAdvisorAssessmentQuestionWriteData,
  defaultScoreMapForAnswerType,
  parseAdvisorAssessmentQuestionInput,
} from "@/lib/methodology/advisor-assessment-question-config";

describe("parseAdvisorAssessmentQuestionInput", () => {
  it("accepts custom maturity labels", () => {
    const parsed = parseAdvisorAssessmentQuestionInput({
      questionText: "Custom Question from Buddy",
      answerType: "scored_0_3",
      answer0: "Not in place",
      answer1: "Partially in place",
      answer2: "Mostly in place",
      answer3: "Fully in place",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.answer0).toBe("Not in place");
  });

  it("rejects empty question text", () => {
    const parsed = parseAdvisorAssessmentQuestionInput({
      questionText: "   ",
      answerType: "yes_no",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("buildAdvisorAssessmentQuestionWriteData", () => {
  it("stores yes/no score map", () => {
    const data = buildAdvisorAssessmentQuestionWriteData({
      questionText: "Do you have a policy?",
      answerType: "yes_no",
      whyThisMatters: null,
      recommendedActions: null,
      answer0: "No",
      answer1: "Yes",
      answer2: null,
      answer3: null,
    });
    expect(data.answerType).toBe("yes_no");
    expect(data.scoreMap).toEqual(defaultScoreMapForAnswerType("yes_no"));
    expect(data.answer0).toBe("No");
    expect(data.answer1).toBe("Yes");
  });

  it("omits empty answer label fields from the write payload", () => {
    const data = buildAdvisorAssessmentQuestionWriteData({
      questionText: "Custom question from Buddy",
      answerType: "yes_no",
      whyThisMatters: null,
      recommendedActions: null,
      answer0: null,
      answer1: null,
      answer2: null,
      answer3: null,
    });

    expect(data).not.toHaveProperty("answer0");
    expect(data).not.toHaveProperty("answer1");
    expect(data).not.toHaveProperty("answer2");
    expect(data).not.toHaveProperty("answer3");
  });
});

describe("advisorAssessmentQuestionToWire", () => {
  it("uses custom maturity labels in client wire", () => {
    const wire = advisorAssessmentQuestionToWire({
      id: "q1",
      displayOrder: 1,
      questionText: "Custom Question from Buddy",
      answerType: "scored_0_3",
      scoreMap: defaultScoreMapForAnswerType("scored_0_3"),
      answer0: "Not in place",
      answer1: "Partially in place",
      answer2: "Mostly in place",
      answer3: "Fully in place",
      whyThisMatters: null,
      recommendedActions: null,
      pillarSlug: "governance",
    });

    expect(wire.type).toBe("maturity-scale");
    expect(wire.options).toEqual([
      { value: 0, label: "Not in place" },
      { value: 1, label: "Partially in place" },
      { value: 2, label: "Mostly in place" },
      { value: 3, label: "Fully in place" },
    ]);
  });

  it("maps yes/no answer labels", () => {
    const wire = advisorAssessmentQuestionToWire({
      id: "q2",
      displayOrder: 2,
      questionText: "Policy in place?",
      answerType: "yes_no",
      scoreMap: defaultScoreMapForAnswerType("yes_no"),
      answer0: "Not yet",
      answer1: "Yes, documented",
      answer2: null,
      answer3: null,
      whyThisMatters: null,
      recommendedActions: null,
      pillarSlug: "governance",
    });

    expect(wire.type).toBe("yes-no");
    expect(wire.options).toEqual([
      { value: "yes", label: "Yes, documented" },
      { value: "no", label: "Not yet" },
    ]);
  });
});
