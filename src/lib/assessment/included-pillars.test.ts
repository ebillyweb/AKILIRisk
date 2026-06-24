import { describe, expect, it } from "vitest";
import {
  DEFAULT_INCLUDED_PILLARS,
  formatIncludedPillarNames,
  formatNarrowScopePreviewCopy,
  isAssessmentScopeComplete,
  isNarrowAssessmentScope,
  isPillarInAssessmentScope,
  normalizeIncludedPillarIds,
  resolveIncludedPillars,
} from "@/lib/assessment/included-pillars";

describe("resolveIncludedPillars", () => {
  it("returns all platform pillars when empty or null", () => {
    expect(resolveIncludedPillars([])).toEqual([...DEFAULT_INCLUDED_PILLARS]);
    expect(resolveIncludedPillars(null)).toEqual([...DEFAULT_INCLUDED_PILLARS]);
    expect(resolveIncludedPillars(undefined)).toEqual([...DEFAULT_INCLUDED_PILLARS]);
  });

  it("returns explicit scope when set", () => {
    expect(resolveIncludedPillars(["governance", "cyber-digital"])).toEqual([
      "governance",
      "cyber-digital",
    ]);
  });
});

describe("normalizeIncludedPillarIds", () => {
  it("dedupes and validates canonical ids", () => {
    expect(
      normalizeIncludedPillarIds([
        "governance",
        "governance",
        "cyber-digital",
      ]),
    ).toEqual(["governance", "cyber-digital"]);
  });

  it("rejects unknown pillar ids", () => {
    expect(() => normalizeIncludedPillarIds(["not-a-pillar"])).toThrow(
      /Unknown assessment pillar/,
    );
  });
});

describe("isAssessmentScopeComplete", () => {
  it("completes with one included pillar scored", () => {
    expect(
      isAssessmentScopeComplete(["governance"], ["governance"]),
    ).toBe(true);
    expect(
      isAssessmentScopeComplete(["governance"], ["governance", "cyber-digital"]),
    ).toBe(false);
  });

  it("completes with three included pillars scored", () => {
    const included = ["governance", "cyber-digital", "insurance"];
    expect(
      isAssessmentScopeComplete(
        ["governance", "cyber-digital", "insurance"],
        included,
      ),
    ).toBe(true);
    expect(
      isAssessmentScopeComplete(["governance", "cyber-digital"], included),
    ).toBe(false);
  });

  it("completes with all six when scope is legacy empty", () => {
    expect(isAssessmentScopeComplete([...DEFAULT_INCLUDED_PILLARS], [])).toBe(
      true,
    );
    expect(
      isAssessmentScopeComplete(
        DEFAULT_INCLUDED_PILLARS.slice(0, 5),
        [],
      ),
    ).toBe(false);
  });

  it("ignores scores for pillars outside scope", () => {
    expect(
      isAssessmentScopeComplete(
        ["governance", "cyber-digital", "physical-security"],
        ["governance"],
      ),
    ).toBe(true);
  });
});

describe("isPillarInAssessmentScope", () => {
  it("allows pillars in scope only", () => {
    expect(isPillarInAssessmentScope("governance", ["governance"])).toBe(true);
    expect(isPillarInAssessmentScope("cyber-digital", ["governance"])).toBe(
      false,
    );
  });
});

describe("scope display helpers", () => {
  it("detects narrow scope when fewer than all platform pillars", () => {
    expect(isNarrowAssessmentScope(["governance", "cyber-digital"])).toBe(true);
    expect(isNarrowAssessmentScope([...DEFAULT_INCLUDED_PILLARS])).toBe(false);
  });

  it("formats pillar names and preview copy", () => {
    expect(formatIncludedPillarNames(["governance", "cyber-digital"])).toBe(
      "Governance, Cyber security",
    );
    expect(formatNarrowScopePreviewCopy(["governance", "cyber-digital"])).toMatch(
      /2 of 10 household risk domains/,
    );
  });
});
