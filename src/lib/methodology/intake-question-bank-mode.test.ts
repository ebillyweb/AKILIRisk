import { describe, expect, it } from "vitest";
import { AdvisorQuestionSource, IntakeQuestionBankMode } from "@prisma/client";
import {
  filterIntakeQuestionsByBankMode,
  intakeQuestionMatchesBankMode,
  isCustomIntakeQuestionSource,
} from "./intake-question-bank-mode";

describe("intake question bank mode", () => {
  it("treats CUSTOM and ENTERPRISE as custom sources", () => {
    expect(isCustomIntakeQuestionSource(AdvisorQuestionSource.CUSTOM)).toBe(true);
    expect(isCustomIntakeQuestionSource(AdvisorQuestionSource.ENTERPRISE)).toBe(true);
    expect(isCustomIntakeQuestionSource(AdvisorQuestionSource.PLATFORM)).toBe(false);
  });

  it("filters rows to platform-only or custom-only sets", () => {
    const rows = [
      { id: "p1", sourceKind: AdvisorQuestionSource.PLATFORM },
      { id: "c1", sourceKind: AdvisorQuestionSource.CUSTOM },
      { id: "e1", sourceKind: AdvisorQuestionSource.ENTERPRISE },
    ];

    expect(filterIntakeQuestionsByBankMode(rows, IntakeQuestionBankMode.PLATFORM)).toEqual([
      { id: "p1", sourceKind: AdvisorQuestionSource.PLATFORM },
    ]);
    expect(filterIntakeQuestionsByBankMode(rows, IntakeQuestionBankMode.CUSTOM)).toEqual([
      { id: "c1", sourceKind: AdvisorQuestionSource.CUSTOM },
      { id: "e1", sourceKind: AdvisorQuestionSource.ENTERPRISE },
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
  });
});
