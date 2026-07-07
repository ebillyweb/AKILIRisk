import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  buildAdvisorIntakeQuestionWriteData,
  parseAdvisorIntakeQuestionInput,
  readAdvisorIntakeQuestionForm,
  validateAdvisorIntakeQuestionFormClient,
} from "./advisor-intake-question-config";

describe("advisor-intake-question-config", () => {
  it("reads choice_list options from repeated optionLabel fields", () => {
    const formData = new FormData();
    formData.set("questionText", "What is your employment status?");
    formData.set("answerType", "choice_list");
    formData.append("optionLabel", "Retired");
    formData.append("optionLabel", "Employed");
    formData.append("optionLabel", "Student");

    expect(readAdvisorIntakeQuestionForm(formData)).toMatchObject({
      questionText: "What is your employment status?",
      answerType: "choice_list",
      options: [
        { value: "0", label: "Retired" },
        { value: "1", label: "Employed" },
        { value: "2", label: "Student" },
      ],
    });
  });

  it("requires at least two options for choice_list", () => {
    const parsed = parseAdvisorIntakeQuestionInput({
      questionText: "Pick one",
      answerType: "choice_list",
      options: [{ value: "0", label: "Only one" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("persists options only for choice_list questions", () => {
    const write = buildAdvisorIntakeQuestionWriteData({
      questionText: "Pick one",
      whyThisMatters: null,
      recommendedActions: null,
      answerType: "choice_list",
      answer0: null,
      answer1: null,
      answer2: null,
      answer3: null,
      options: [
        { value: "0", label: "A" },
        { value: "1", label: "B" },
      ],
    });
    expect(write.options).toEqual([
      { value: "0", label: "A" },
      { value: "1", label: "B" },
    ]);

    const fillable = buildAdvisorIntakeQuestionWriteData({
      questionText: "Describe",
      whyThisMatters: null,
      recommendedActions: null,
      answerType: "fillable",
      answer0: null,
      answer1: null,
      answer2: null,
      answer3: null,
    });
    expect(fillable.options).toBe(Prisma.JsonNull);
  });

  it("validates choice_list option count on the client form", () => {
    const formData = new FormData();
    formData.set("questionText", "Pick one");
    formData.set("answerType", "choice_list");
    formData.append("optionLabel", "Only one");

    expect(validateAdvisorIntakeQuestionFormClient(formData)).toMatch(
      /at least 2/i,
    );
  });
});
