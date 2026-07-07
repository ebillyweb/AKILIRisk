import {
  AdvisorQuestionSource,
  IntakeQuestionBankMode,
} from "@prisma/client";

export type IntakeQuestionRowWithSource = {
  sourceKind: AdvisorQuestionSource;
  displayOrder?: number;
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
  if (mode === IntakeQuestionBankMode.COMBINED) return true;
  const isCustom = isCustomIntakeQuestionSource(sourceKind);
  return mode === IntakeQuestionBankMode.CUSTOM ? isCustom : !isCustom;
}

export function filterIntakeQuestionsByBankMode<T extends IntakeQuestionRowWithSource>(
  rows: T[],
  mode: IntakeQuestionBankMode,
): T[] {
  return rows.filter((row) => intakeQuestionMatchesBankMode(row.sourceKind, mode));
}

/** Platform rows first, then custom/enterprise, each group by displayOrder. */
export function compareQuestionsByBankMode<T extends IntakeQuestionRowWithSource>(
  a: T,
  b: T,
  mode: IntakeQuestionBankMode,
): number {
  if (mode === IntakeQuestionBankMode.COMBINED) {
    const aCustom = isCustomIntakeQuestionSource(a.sourceKind) ? 1 : 0;
    const bCustom = isCustomIntakeQuestionSource(b.sourceKind) ? 1 : 0;
    if (aCustom !== bCustom) return aCustom - bCustom;
  }
  return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
}

export function filterAndOrderQuestionsByBankMode<T extends IntakeQuestionRowWithSource>(
  rows: T[],
  mode: IntakeQuestionBankMode,
): T[] {
  return filterIntakeQuestionsByBankMode(rows, mode).sort((a, b) =>
    compareQuestionsByBankMode(a, b, mode),
  );
}

export function bankModeSwitchSuccessMessage(mode: IntakeQuestionBankMode): string {
  switch (mode) {
    case IntakeQuestionBankMode.PLATFORM:
      return "Switched to platform-only question bank";
    case IntakeQuestionBankMode.COMBINED:
      return "Switched to combined question bank";
    case IntakeQuestionBankMode.CUSTOM:
      return "Switched to custom-only question bank";
    default:
      return "Question bank updated";
  }
}

/** Custom-only with zero saved questions behaves as platform for clients. */
export function effectiveQuestionBankMode(
  mode: IntakeQuestionBankMode,
  customQuestionCount: number,
): IntakeQuestionBankMode {
  if (mode === IntakeQuestionBankMode.CUSTOM && customQuestionCount === 0) {
    return IntakeQuestionBankMode.PLATFORM;
  }
  return mode;
}

export function isCustomOnlyWithoutSavedQuestions(
  mode: IntakeQuestionBankMode,
  customQuestionCount: number,
): boolean {
  return mode === IntakeQuestionBankMode.CUSTOM && customQuestionCount === 0;
}

export function customOnlyEmptyBankMessage(experienceNoun: "intake" | "assessment"): string {
  return `Custom only requires at least one saved custom question. New client ${experienceNoun === "intake" ? "intakes" : "assessments"} will use the platform question bank instead.`;
}

export function resolveBankModeForUpdate(
  requested: IntakeQuestionBankMode,
  customQuestionCount: number,
): { mode: IntakeQuestionBankMode; coercedToPlatform: boolean } {
  if (isCustomOnlyWithoutSavedQuestions(requested, customQuestionCount)) {
    return { mode: IntakeQuestionBankMode.PLATFORM, coercedToPlatform: true };
  }
  return { mode: requested, coercedToPlatform: false };
}
