import {
  AdvisorQuestionSource,
  IntakeQuestionBankMode,
} from "@prisma/client";

export type IntakeQuestionRowWithSource = {
  sourceKind: AdvisorQuestionSource;
};

export function isCustomIntakeQuestionSource(sourceKind: AdvisorQuestionSource): boolean {
  return (
    sourceKind === AdvisorQuestionSource.CUSTOM ||
    sourceKind === AdvisorQuestionSource.ENTERPRISE
  );
}

export function intakeQuestionMatchesBankMode(
  sourceKind: AdvisorQuestionSource,
  mode: IntakeQuestionBankMode,
): boolean {
  const isCustom = isCustomIntakeQuestionSource(sourceKind);
  return mode === IntakeQuestionBankMode.CUSTOM ? isCustom : !isCustom;
}

export function filterIntakeQuestionsByBankMode<T extends IntakeQuestionRowWithSource>(
  rows: T[],
  mode: IntakeQuestionBankMode,
): T[] {
  return rows.filter((row) => intakeQuestionMatchesBankMode(row.sourceKind, mode));
}
