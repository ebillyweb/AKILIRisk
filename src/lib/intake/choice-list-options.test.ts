import { describe, expect, it } from "vitest";

import {
  INTAKE_CHOICE_LIST_MAX,
  normalizeIntakeChoiceListOptions,
  parseStoredIntakeChoiceListOptions,
  resolveIntakeChoiceListLabel,
} from "./choice-list-options";

describe("choice-list-options", () => {
  it("normalizes trimmed labels into indexed values", () => {
    expect(normalizeIntakeChoiceListOptions([" Alpha ", "", "Beta"])).toEqual([
      { value: "0", label: "Alpha" },
      { value: "1", label: "Beta" },
    ]);
  });

  it("caps normalized options at the maximum", () => {
    const labels = Array.from({ length: INTAKE_CHOICE_LIST_MAX + 3 }, (_, index) => `Option ${index}`);
    expect(normalizeIntakeChoiceListOptions(labels)).toHaveLength(INTAKE_CHOICE_LIST_MAX);
  });

  it("parses stored JSON options and resolves labels", () => {
    const stored = [
      { value: "0", label: "Retired" },
      { value: "1", label: "Employed" },
    ];
    expect(parseStoredIntakeChoiceListOptions(stored)).toEqual(stored);
    expect(resolveIntakeChoiceListLabel(stored, "1")).toBe("Employed");
    expect(resolveIntakeChoiceListLabel(stored, "missing")).toBeNull();
  });
});
