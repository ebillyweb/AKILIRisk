import { describe, expect, it } from "vitest";
import { AdvisorQuestionSource } from "@prisma/client";
import {
  canDeleteAdvisorQuestion,
  isEnterpriseAdvisorQuestion,
  isPlatformAdvisorQuestion,
} from "@/lib/methodology/advisor-question-policy";

describe("enterprise recommendation rule policy", () => {
  it("ENTERPRISE source is recognized as enterprise", () => {
    expect(isEnterpriseAdvisorQuestion(AdvisorQuestionSource.ENTERPRISE)).toBe(true);
    expect(isEnterpriseAdvisorQuestion(AdvisorQuestionSource.PLATFORM)).toBe(false);
    expect(isEnterpriseAdvisorQuestion(AdvisorQuestionSource.CUSTOM)).toBe(false);
  });

  it("ENTERPRISE rows are non-deletable (like PLATFORM)", () => {
    expect(canDeleteAdvisorQuestion(AdvisorQuestionSource.ENTERPRISE)).toBe(false);
  });

  it("ENTERPRISE rows are not classified as platform", () => {
    expect(isPlatformAdvisorQuestion(AdvisorQuestionSource.ENTERPRISE)).toBe(false);
  });

  it("CUSTOM rows remain deletable", () => {
    expect(canDeleteAdvisorQuestion(AdvisorQuestionSource.CUSTOM)).toBe(true);
  });

  it("PLATFORM rows remain non-deletable", () => {
    expect(canDeleteAdvisorQuestion(AdvisorQuestionSource.PLATFORM)).toBe(false);
  });
});

describe("enterprise sourceKind hierarchy", () => {
  it("has three valid source kinds", () => {
    const kinds = Object.values(AdvisorQuestionSource);
    expect(kinds).toContain("PLATFORM");
    expect(kinds).toContain("ENTERPRISE");
    expect(kinds).toContain("CUSTOM");
    expect(kinds).toHaveLength(3);
  });

  it("only CUSTOM is deletable", () => {
    const deletable = Object.values(AdvisorQuestionSource).filter(canDeleteAdvisorQuestion);
    expect(deletable).toEqual(["CUSTOM"]);
  });
});
