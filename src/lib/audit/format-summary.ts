/**
 * Build a one-line human-readable summary of an audit row's diff for the
 * admin table view. Stays narrow on purpose — full payloads go in the
 * row-detail modal.
 *
 * Cases:
 *  - create (beforeData null, afterData object): "created with: <keys>"
 *  - delete (beforeData object, afterData null): "deleted (had: <keys>)"
 *  - update: "changed: <keys-with-different-values>"
 *  - read (both null): "—"
 *
 * Doesn't try to render values — just the field names that changed. Avoids
 * leaking PII into the table view; admins click into the modal to see
 * actual before/after values.
 */
export function formatAuditDiffSummary(
  beforeData: unknown,
  afterData: unknown
): string {
  const before = isPlainObject(beforeData) ? beforeData : null;
  const after = isPlainObject(afterData) ? afterData : null;

  if (before === null && after === null) return "—";

  if (before === null && after !== null) {
    const keys = Object.keys(after).slice(0, 5);
    const more = Object.keys(after).length - keys.length;
    return `created with: ${keys.join(", ")}${more > 0 ? ` (+${more} more)` : ""}`;
  }

  if (before !== null && after === null) {
    const keys = Object.keys(before).slice(0, 5);
    const more = Object.keys(before).length - keys.length;
    return `deleted (had: ${keys.join(", ")}${more > 0 ? ` +${more} more` : ""})`;
  }

  // Both non-null — compute changed keys.
  const changed: string[] = [];
  const beforeKeys = Object.keys(before!);
  const afterKeys = Object.keys(after!);
  const allKeys = new Set([...beforeKeys, ...afterKeys]);

  for (const k of allKeys) {
    const b = (before as Record<string, unknown>)[k];
    const a = (after as Record<string, unknown>)[k];
    if (!shallowEqual(b, a)) changed.push(k);
  }

  if (changed.length === 0) return "(no changes detected)";

  const head = changed.slice(0, 5);
  const more = changed.length - head.length;
  return `changed: ${head.join(", ")}${more > 0 ? ` (+${more} more)` : ""}`;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Cheap structural equality for the diff summary. We only need to know
 * "did this field's value change", not produce a deep diff.
 *  - Primitives: strict equal.
 *  - Arrays / objects: JSON-string compare. Handles the common shapes that
 *    flow through audit payloads (DTOs, dates serialized to ISO strings).
 */
function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a === "object") {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}
