export const INTAKE_CHOICE_LIST_MIN = 2;
export const INTAKE_CHOICE_LIST_MAX = 10;

export type IntakeChoiceListOption = {
  value: string;
  label: string;
};

export function normalizeIntakeChoiceListOptions(
  labels: string[],
): IntakeChoiceListOption[] {
  return labels
    .map((label) => label.trim())
    .filter(Boolean)
    .slice(0, INTAKE_CHOICE_LIST_MAX)
    .map((label, index) => ({
      value: String(index),
      label,
    }));
}

export function parseStoredIntakeChoiceListOptions(
  raw: unknown,
): IntakeChoiceListOption[] {
  if (!Array.isArray(raw)) return [];

  const options: IntakeChoiceListOption[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const label = typeof record.label === "string" ? record.label.trim() : "";
    if (!label) continue;
    const value =
      typeof record.value === "string" || typeof record.value === "number"
        ? String(record.value)
        : String(options.length);
    options.push({ value, label });
    if (options.length >= INTAKE_CHOICE_LIST_MAX) break;
  }

  return options;
}

export function resolveIntakeChoiceListLabel(
  options: IntakeChoiceListOption[] | null | undefined,
  storedValue: string | null | undefined,
): string | null {
  const value = storedValue?.trim();
  if (!value) return null;
  const match = (options ?? []).find((option) => option.value === value);
  return match?.label ?? null;
}
