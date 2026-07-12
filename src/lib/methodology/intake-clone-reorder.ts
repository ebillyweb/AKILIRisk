export type ReorderableIntakeRow = { id: string; displayOrder: number };

export type CustomIntakeReorderPlan =
  | { ok: true; move: ReorderableIntakeRow; swapWith: ReorderableIntakeRow }
  | { ok: false; reason: "not_found" | "boundary" };

/**
 * Plan an up/down move of a custom intake question within the firm/advisor
 * custom block. `customRows` are the scope's custom-source clone rows (any
 * order); the move swaps `displayOrder` between the target and its neighbor
 * once the rows are sorted by `displayOrder`.
 *
 * Scope A: reordering stays within the custom block. Platform-sourced rows are
 * never passed in, so a custom question can be reordered relative to other
 * custom questions but cannot move above the platform block in COMBINED mode.
 *
 * The intake clone models (AdvisorIntakeQuestion / EnterpriseIntakeQuestion)
 * have no `@@unique` on displayOrder, so a plain pairwise swap is safe — no
 * temporary-slot parking is required (unlike the platform `questions` table).
 */
export function planCustomIntakeReorder(
  customRows: ReorderableIntakeRow[],
  questionId: string,
  direction: "up" | "down",
): CustomIntakeReorderPlan {
  const sorted = [...customRows].sort((a, b) => a.displayOrder - b.displayOrder);
  const idx = sorted.findIndex((r) => r.id === questionId);
  if (idx < 0) return { ok: false, reason: "not_found" };

  const neighborIdx = direction === "up" ? idx - 1 : idx + 1;
  if (neighborIdx < 0 || neighborIdx >= sorted.length) {
    return { ok: false, reason: "boundary" };
  }

  return { ok: true, move: sorted[idx]!, swapWith: sorted[neighborIdx]! };
}
