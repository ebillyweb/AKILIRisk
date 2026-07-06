import { describe, expect, it } from "vitest";
import { AdvisorQuestionSource, IntakeQuestionBankMode } from "@prisma/client";
import {
  compareQuestionsByBankMode,
  effectiveQuestionBankMode,
  filterAndOrderQuestionsByBankMode,
  filterIntakeQuestionsByBankMode,
  intakeQuestionMatchesBankMode,
  isCustomIntakeQuestionSource,
  isCustomOnlyWithoutSavedQuestions,
  resolveBankModeForUpdate,
} from "./intake-question-bank-mode";

describe("intake question bank mode", () => {
  it("treats CUSTOM and ENTERPRISE as custom sources", () => {
    expect(isCustomIntakeQuestionSource(AdvisorQuestionSource.CUSTOM)).toBe(true);
    expect(isCustomIntakeQuestionSource(AdvisorQuestionSource.ENTERPRISE)).toBe(true);
    expect(isCustomIntakeQuestionSource(AdvisorQuestionSource.PLATFORM)).toBe(false);
  });

  it("filters rows to platform-only, combined, or custom-only sets", () => {
    const rows = [
      { id: "p1", sourceKind: AdvisorQuestionSource.PLATFORM, displayOrder: 1 },
      { id: "c1", sourceKind: AdvisorQuestionSource.CUSTOM, displayOrder: 0 },
      { id: "e1", sourceKind: AdvisorQuestionSource.ENTERPRISE, displayOrder: 2 },
    ];

    expect(filterIntakeQuestionsByBankMode(rows, IntakeQuestionBankMode.PLATFORM)).toEqual([
      { id: "p1", sourceKind: AdvisorQuestionSource.PLATFORM, displayOrder: 1 },
    ]);
    expect(filterIntakeQuestionsByBankMode(rows, IntakeQuestionBankMode.CUSTOM)).toEqual([
      { id: "c1", sourceKind: AdvisorQuestionSource.CUSTOM, displayOrder: 0 },
      { id: "e1", sourceKind: AdvisorQuestionSource.ENTERPRISE, displayOrder: 2 },
    ]);
    expect(filterIntakeQuestionsByBankMode(rows, IntakeQuestionBankMode.COMBINED)).toEqual(rows);
  });

  it("orders combined mode with platform first then custom", () => {
    const rows = [
      { id: "c1", sourceKind: AdvisorQuestionSource.CUSTOM, displayOrder: 0 },
      { id: "p2", sourceKind: AdvisorQuestionSource.PLATFORM, displayOrder: 5 },
      { id: "p1", sourceKind: AdvisorQuestionSource.PLATFORM, displayOrder: 1 },
      { id: "e1", sourceKind: AdvisorQuestionSource.ENTERPRISE, displayOrder: 2 },
    ];

    expect(filterAndOrderQuestionsByBankMode(rows, IntakeQuestionBankMode.COMBINED)).toEqual([
      { id: "p1", sourceKind: AdvisorQuestionSource.PLATFORM, displayOrder: 1 },
      { id: "p2", sourceKind: AdvisorQuestionSource.PLATFORM, displayOrder: 5 },
      { id: "c1", sourceKind: AdvisorQuestionSource.CUSTOM, displayOrder: 0 },
      { id: "e1", sourceKind: AdvisorQuestionSource.ENTERPRISE, displayOrder: 2 },
    ]);
  });

  it("matches source kind against active bank mode", () => {
    expect(
      intakeQuestionMatchesBankMode(
        AdvisorQuestionSource.PLATFORM,
        IntakeQuestionBankMode.PLATFORM,
      ),
    ).toBe(true);
    expect(
      intakeQuestionMatchesBankMode(
        AdvisorQuestionSource.CUSTOM,
        IntakeQuestionBankMode.PLATFORM,
      ),
    ).toBe(false);
    expect(
      intakeQuestionMatchesBankMode(
        AdvisorQuestionSource.ENTERPRISE,
        IntakeQuestionBankMode.CUSTOM,
      ),
    ).toBe(true);
    expect(
      intakeQuestionMatchesBankMode(
        AdvisorQuestionSource.PLATFORM,
        IntakeQuestionBankMode.COMBINED,
      ),
    ).toBe(true);
    expect(
      intakeQuestionMatchesBankMode(
        AdvisorQuestionSource.CUSTOM,
        IntakeQuestionBankMode.COMBINED,
      ),
    ).toBe(true);
  });

  it("sorts within a single group by displayOrder", () => {
    const a = { sourceKind: AdvisorQuestionSource.PLATFORM, displayOrder: 3 };
    const b = { sourceKind: AdvisorQuestionSource.PLATFORM, displayOrder: 1 };
    expect(compareQuestionsByBankMode(a, b, IntakeQuestionBankMode.PLATFORM)).toBeGreaterThan(0);
  });

  it("treats custom-only with no saved questions as platform for clients", () => {
    expect(
      effectiveQuestionBankMode(IntakeQuestionBankMode.CUSTOM, 0),
    ).toBe(IntakeQuestionBankMode.PLATFORM);
    expect(isCustomOnlyWithoutSavedQuestions(IntakeQuestionBankMode.CUSTOM, 0)).toBe(true);
    expect(resolveBankModeForUpdate(IntakeQuestionBankMode.CUSTOM, 0)).toEqual({
      mode: IntakeQuestionBankMode.PLATFORM,
      coercedToPlatform: true,
    });
  });
});
