import { describe, expect, it } from "vitest";
import {
  governanceParentNeedsDocumentUploadSub,
  GOVERNANCE_DOCUMENT_UPLOAD_PARENT_NUMBERS,
  scored0_3TierImpliesDocumentation,
  suggestDocumentUploadSubNumber,
} from "./governance-document-upload";

describe("scored0_3TierImpliesDocumentation", () => {
  it("matches parents whose 3rd/4th labels reference documentation", () => {
    expect(
      scored0_3TierImpliesDocumentation({
        answerType: "scored_0_3",
        answer2: "Documented",
        answer3: "Documented + trained",
      })
    ).toBe(true);
    expect(
      scored0_3TierImpliesDocumentation({
        answerType: "scored_0_3",
        answer2: "Established",
        answer3: "Active + documented",
      })
    ).toBe(true);
  });

  it("does not match tiers without documentation language", () => {
    expect(
      scored0_3TierImpliesDocumentation({
        answerType: "scored_0_3",
        answer2: "Regular",
        answer3: "Regular + agendas + minutes",
      })
    ).toBe(false);
  });
});

describe("governanceParentNeedsDocumentUploadSub", () => {
  it("lists all documented-tier governance parents", () => {
    expect(GOVERNANCE_DOCUMENT_UPLOAD_PARENT_NUMBERS).toContain("D4");
    expect(GOVERNANCE_DOCUMENT_UPLOAD_PARENT_NUMBERS).toContain("B5");
    expect(governanceParentNeedsDocumentUploadSub("A3")).toBe(false);
  });
});

describe("suggestDocumentUploadSubNumber", () => {
  it("skips suffixes already used by sibling subs", () => {
    expect(suggestDocumentUploadSubNumber("A4", ["A4a", "A4b"])).toBe("A4c");
    expect(suggestDocumentUploadSubNumber("A2", [])).toBe("A2a");
  });
});
