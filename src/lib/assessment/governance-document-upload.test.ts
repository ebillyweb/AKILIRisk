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

  it("matches cyber A2 documented tiers", () => {
    expect(
      scored0_3TierImpliesDocumentation({
        answerType: "scored_0_3",
        answer2: "Documented",
        answer3: "Documented and reinforced",
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
  it("legacy static list is deprecated; tier detection drives subs", () => {
    expect(GOVERNANCE_DOCUMENT_UPLOAD_PARENT_NUMBERS).toContain("D4");
    expect(governanceParentNeedsDocumentUploadSub("A3")).toBe(false);
    expect(
      scored0_3TierImpliesDocumentation({
        answerType: "scored_0_3",
        answer2: "Defined",
        answer3: "Documented and enforced",
      })
    ).toBe(true);
  });
});

describe("suggestDocumentUploadSubNumber", () => {
  it("skips suffixes already used by sibling subs", () => {
    expect(suggestDocumentUploadSubNumber("A4", ["A4a", "A4b"])).toBe("A4c");
    expect(suggestDocumentUploadSubNumber("A2", [])).toBe("A2a");
    expect(suggestDocumentUploadSubNumber("6.3", [])).toBe("6.3a");
  });
});
