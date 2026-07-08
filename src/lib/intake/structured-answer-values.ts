import {
  resolveIntakeChoiceListLabel,
  type IntakeChoiceListOption,
} from "@/lib/intake/choice-list-options";

/**
 * Serialization helpers for the structured intake answer types whose stored
 * value is richer than a single option token:
 *  - `multi_select`  → a JSON array of selected option values ("select all that apply")
 *  - `property_list` → a JSON array of `{ zip, label? }` entries (up to 5 properties)
 *
 * Both serialize into the single (encrypted) response string the interview
 * already persists, so no schema change is required.
 */

// ---------------------------------------------------------------------------
// Multi-select ("select all that apply")
// ---------------------------------------------------------------------------

/** Parse a stored multi-select value into the list of selected option values. */
export function parseMultiSelectValue(
  raw: string | null | undefined,
): string[] {
  const value = raw?.trim();
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
  } catch {
    // Legacy / single-value fallback: treat a bare token as one selection.
  }
  return [value];
}

/** Serialize selected option values; returns "" when nothing is selected. */
export function serializeMultiSelectValue(values: string[]): string {
  const unique = Array.from(
    new Set(values.map((v) => v.trim()).filter(Boolean)),
  );
  return unique.length ? JSON.stringify(unique) : "";
}

/** Human-readable label list for a stored multi-select value. */
export function formatMultiSelectForDisplay(
  options: IntakeChoiceListOption[] | null | undefined,
  raw: string | null | undefined,
): string | null {
  const values = parseMultiSelectValue(raw);
  if (!values.length) return null;
  return values
    .map((value) => resolveIntakeChoiceListLabel(options, value) ?? value)
    .join(", ");
}

// ---------------------------------------------------------------------------
// Property list (ZIP per property, up to 5)
// ---------------------------------------------------------------------------

export const MAX_PROPERTY_ENTRIES = 5;

export type PropertyEntry = {
  /** US ZIP code (5-digit or ZIP+4). */
  zip: string;
  /** Optional friendly label, e.g. "Primary residence", "Beach house". */
  label?: string;
};

/** True for a 5-digit ZIP or ZIP+4. */
export function isValidZip(zip: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(zip.trim());
}

/** Parse a stored property-list value into structured entries. */
export function parsePropertyListValue(
  raw: string | null | undefined,
): PropertyEntry[] {
  const value = raw?.trim();
  if (!value) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const entries: PropertyEntry[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const zip = typeof record.zip === "string" ? record.zip.trim() : "";
    const label = typeof record.label === "string" ? record.label.trim() : "";
    if (!zip && !label) continue;
    entries.push(label ? { zip, label } : { zip });
    if (entries.length >= MAX_PROPERTY_ENTRIES) break;
  }
  return entries;
}

/**
 * Serialize property entries; keeps only entries that carry a ZIP, caps at
 * MAX_PROPERTY_ENTRIES, and returns "" when there is nothing to store.
 */
export function serializePropertyListValue(entries: PropertyEntry[]): string {
  const cleaned = entries
    .map((entry) => ({
      zip: entry.zip.trim(),
      label: entry.label?.trim() ?? "",
    }))
    .filter((entry) => entry.zip.length > 0)
    .slice(0, MAX_PROPERTY_ENTRIES)
    .map((entry) => (entry.label ? { zip: entry.zip, label: entry.label } : { zip: entry.zip }));
  return cleaned.length ? JSON.stringify(cleaned) : "";
}

/** Human-readable summary for a stored property-list value. */
export function formatPropertyListForDisplay(
  raw: string | null | undefined,
): string | null {
  const entries = parsePropertyListValue(raw);
  if (!entries.length) return null;
  return entries
    .map((entry, index) => {
      const name = entry.label || `Property ${index + 1}`;
      return `${name}: ${entry.zip}`;
    })
    .join("; ");
}
