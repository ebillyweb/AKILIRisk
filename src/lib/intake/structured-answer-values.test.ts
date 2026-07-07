import { describe, expect, it } from "vitest";

import {
  formatMultiSelectForDisplay,
  formatPropertyListForDisplay,
  isValidZip,
  MAX_PROPERTY_ENTRIES,
  parseMultiSelectValue,
  parsePropertyListValue,
  serializeMultiSelectValue,
  serializePropertyListValue,
} from "./structured-answer-values";

describe("multi-select values", () => {
  it("round-trips selected values", () => {
    const serialized = serializeMultiSelectValue(["0", "2"]);
    expect(parseMultiSelectValue(serialized)).toEqual(["0", "2"]);
  });

  it("dedupes and drops blanks", () => {
    expect(serializeMultiSelectValue(["1", "1", "", " "])).toBe(JSON.stringify(["1"]));
  });

  it("returns empty string when nothing selected", () => {
    expect(serializeMultiSelectValue([])).toBe("");
    expect(parseMultiSelectValue("")).toEqual([]);
    expect(parseMultiSelectValue(null)).toEqual([]);
  });

  it("falls back to a bare legacy token", () => {
    expect(parseMultiSelectValue("2")).toEqual(["2"]);
  });

  it("formats selected values to their labels", () => {
    const options = [
      { value: "0", label: "Boating" },
      { value: "1", label: "Aviation" },
      { value: "2", label: "Firearms" },
    ];
    expect(formatMultiSelectForDisplay(options, serializeMultiSelectValue(["0", "2"]))).toBe(
      "Boating, Firearms",
    );
    expect(formatMultiSelectForDisplay(options, "")).toBeNull();
  });
});

describe("property-list values", () => {
  it("round-trips entries with and without labels", () => {
    const serialized = serializePropertyListValue([
      { zip: "90210", label: "Beach house" },
      { zip: "10001", label: "" },
    ]);
    expect(parsePropertyListValue(serialized)).toEqual([
      { zip: "90210", label: "Beach house" },
      { zip: "10001" },
    ]);
  });

  it("drops rows without a ZIP and caps at the max", () => {
    const entries = Array.from({ length: MAX_PROPERTY_ENTRIES + 2 }, (_, i) => ({
      zip: `1000${i}`,
    }));
    entries.push({ zip: "" });
    const parsed = parsePropertyListValue(serializePropertyListValue(entries));
    expect(parsed).toHaveLength(MAX_PROPERTY_ENTRIES);
  });

  it("returns empty string when there are no ZIPs", () => {
    expect(serializePropertyListValue([{ zip: "", label: "Label only" }])).toBe("");
    expect(parsePropertyListValue("")).toEqual([]);
    expect(parsePropertyListValue("not json")).toEqual([]);
  });

  it("formats a human-readable summary", () => {
    const serialized = serializePropertyListValue([
      { zip: "90210", label: "Beach house" },
      { zip: "10001" },
    ]);
    expect(formatPropertyListForDisplay(serialized)).toBe(
      "Beach house: 90210; Property 2: 10001",
    );
  });

  it("validates ZIP and ZIP+4", () => {
    expect(isValidZip("90210")).toBe(true);
    expect(isValidZip("90210-1234")).toBe(true);
    expect(isValidZip("9021")).toBe(false);
    expect(isValidZip("abcde")).toBe(false);
  });
});
