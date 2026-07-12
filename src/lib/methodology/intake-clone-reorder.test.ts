import { describe, expect, it } from "vitest";

import { planCustomIntakeReorder } from "./intake-clone-reorder";

const rows = [
  { id: "a", displayOrder: 3 },
  { id: "b", displayOrder: 5 },
  { id: "c", displayOrder: 9 },
];

describe("planCustomIntakeReorder", () => {
  it("swaps a row with its lower neighbor when moving up", () => {
    const plan = planCustomIntakeReorder(rows, "b", "up");
    expect(plan).toEqual({
      ok: true,
      move: { id: "b", displayOrder: 5 },
      swapWith: { id: "a", displayOrder: 3 },
    });
  });

  it("swaps a row with its higher neighbor when moving down", () => {
    const plan = planCustomIntakeReorder(rows, "b", "down");
    expect(plan).toEqual({
      ok: true,
      move: { id: "b", displayOrder: 5 },
      swapWith: { id: "c", displayOrder: 9 },
    });
  });

  it("sorts by displayOrder regardless of input order", () => {
    const shuffled = [rows[2], rows[0], rows[1]];
    const plan = planCustomIntakeReorder(shuffled, "a", "down");
    expect(plan).toEqual({
      ok: true,
      move: { id: "a", displayOrder: 3 },
      swapWith: { id: "b", displayOrder: 5 },
    });
  });

  it("reports a boundary no-op at the top of the block", () => {
    expect(planCustomIntakeReorder(rows, "a", "up")).toEqual({
      ok: false,
      reason: "boundary",
    });
  });

  it("reports a boundary no-op at the bottom of the block", () => {
    expect(planCustomIntakeReorder(rows, "c", "down")).toEqual({
      ok: false,
      reason: "boundary",
    });
  });

  it("reports not_found for an unknown id", () => {
    expect(planCustomIntakeReorder(rows, "zzz", "up")).toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});
