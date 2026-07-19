import { describe, expect, it } from "vitest";
import {
  DEFAULT_INCLUDED_PILLARS,
  formatIncludedPillarNames,
  formatNarrowScopePreviewCopy,
  isAssessmentScopeComplete,
  isLegacySixPillarScope,
  isNarrowAssessmentScope,
  isPillarInAssessmentScope,
  LEGACY_SIX_INCLUDED_PILLARS,
  normalizeIncludedPillarIds,
  resolveIncludedPillars,
} from "@/lib/assessment/included-pillars";
import { starterPillarCatalog } from "@/lib/methodology/pillar-catalog";

const catalog = starterPillarCatalog();

describe("isLegacySixPillarScope", () => {
  it("detects the original Belvedere six regardless of order", () => {
    expect(isLegacySixPillarScope([...LEGACY_SIX_INCLUDED_PILLARS].reverse())).toBe(
      true,
    );
    expect(isLegacySixPillarScope([...LEGACY_SIX_INCLUDED_PILLARS, "liquidity-cash"])).toBe(
      false,
    );
    expect(isLegacySixPillarScope(["governance", "cyber-digital"])).toBe(false);
  });
});

describe("resolveIncludedPillars", () => {
  it("returns all platform pillars when empty or null", () => {
    expect(resolveIncludedPillars([], catalog)).toEqual([...DEFAULT_INCLUDED_PILLARS]);
    expect(resolveIncludedPillars(null, catalog)).toEqual([...DEFAULT_INCLUDED_PILLARS]);
    expect(resolveIncludedPillars(undefined, catalog)).toEqual([...DEFAULT_INCLUDED_PILLARS]);
  });

  it("returns explicit scope when set", () => {
    expect(resolveIncludedPillars(["governance", "cyber-digital"], catalog)).toEqual([
      "governance",
      "cyber-digital",
    ]);
  });
});

describe("normalizeIncludedPillarIds", () => {
  it("dedupes and validates canonical ids", () => {
    expect(
      normalizeIncludedPillarIds(
        [
          "governance",
          "governance",
          "cyber-digital",
        ],
        catalog,
      ),
    ).toEqual(["governance", "cyber-digital"]);
  });

  it("rejects unknown pillar ids", () => {
    expect(() => normalizeIncludedPillarIds(["not-a-pillar"], catalog)).toThrow(
      /Unknown assessment pillar/,
    );
  });
});

describe("isAssessmentScopeComplete", () => {
  it("completes with one included pillar scored", () => {
    expect(
      isAssessmentScopeComplete(["governance"], ["governance"], catalog),
    ).toBe(true);
    expect(
      isAssessmentScopeComplete(["governance"], ["governance", "cyber-digital"], catalog),
    ).toBe(false);
  });

  it("completes with three included pillars scored", () => {
    const included = ["governance", "cyber-digital", "insurance"];
    expect(
      isAssessmentScopeComplete(
        ["governance", "cyber-digital", "insurance"],
        included,
        catalog,
      ),
    ).toBe(true);
    expect(
      isAssessmentScopeComplete(["governance", "cyber-digital"], included, catalog),
    ).toBe(false);
  });

  it("completes with all pillars when scope is legacy empty", () => {
    expect(isAssessmentScopeComplete([...DEFAULT_INCLUDED_PILLARS], [], catalog)).toBe(
      true,
    );
    expect(
      isAssessmentScopeComplete(
        DEFAULT_INCLUDED_PILLARS.slice(0, 5),
        [],
        catalog,
      ),
    ).toBe(false);
  });

  it("ignores scores for pillars outside scope", () => {
    expect(
      isAssessmentScopeComplete(
        ["governance", "cyber-digital", "physical-security"],
        ["governance"],
        catalog,
      ),
    ).toBe(true);
  });
});

describe("isPillarInAssessmentScope", () => {
  it("allows pillars in scope only", () => {
    expect(isPillarInAssessmentScope("governance", ["governance"], catalog)).toBe(true);
    expect(isPillarInAssessmentScope("cyber-digital", ["governance"], catalog)).toBe(
      false,
    );
  });
});

describe("scope display helpers", () => {
  it("detects narrow scope when fewer than all platform pillars", () => {
    expect(isNarrowAssessmentScope(["governance", "cyber-digital"], catalog)).toBe(true);
    expect(isNarrowAssessmentScope([...DEFAULT_INCLUDED_PILLARS], catalog)).toBe(false);
  });

  it("formats pillar names and preview copy", () => {
    expect(formatIncludedPillarNames(["governance", "cyber-digital"], catalog)).toBe(
      "Governance & Decision-Making, Cyber & Digital Security",
    );
    expect(formatNarrowScopePreviewCopy(["governance", "cyber-digital"], catalog)).toMatch(
      /2 of 10 household risk domains/,
    );
  });
});
