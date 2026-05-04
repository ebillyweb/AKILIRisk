import { describe, it, expect } from "vitest";
import { formatAuditDiffSummary } from "./format-summary";

describe("formatAuditDiffSummary", () => {
  it("renders dash for read events (both null)", () => {
    expect(formatAuditDiffSummary(null, null)).toBe("—");
  });

  it("renders create events", () => {
    const summary = formatAuditDiffSummary(null, { id: "u1", role: "ADVISOR", email: { emailHash: "abc" } });
    expect(summary).toBe("created with: id, role, email");
  });

  it("truncates long key lists with +N more", () => {
    const obj = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`k${i}`, i]));
    const summary = formatAuditDiffSummary(null, obj);
    expect(summary).toMatch(/^created with: k0, k1, k2, k3, k4 \(\+7 more\)$/);
  });

  it("renders delete events", () => {
    const summary = formatAuditDiffSummary({ name: "x", weight: 5 }, null);
    expect(summary).toBe("deleted (had: name, weight)");
  });

  it("renders update with changed keys only", () => {
    const summary = formatAuditDiffSummary(
      { name: "old", weight: 5, type: "yes-no" },
      { name: "new", weight: 5, type: "yes-no" }
    );
    expect(summary).toBe("changed: name");
  });

  it("renders no-changes when before and after match", () => {
    const summary = formatAuditDiffSummary(
      { name: "x", weight: 5 },
      { name: "x", weight: 5 }
    );
    expect(summary).toBe("(no changes detected)");
  });

  it("treats non-object before/after as missing", () => {
    expect(formatAuditDiffSummary("hello", null)).toBe("—");
    expect(formatAuditDiffSummary(null, 42)).toBe("—");
  });

  it("compares arrays structurally", () => {
    const summary = formatAuditDiffSummary(
      { tags: ["a", "b"] },
      { tags: ["a", "b"] }
    );
    expect(summary).toBe("(no changes detected)");
    const changed = formatAuditDiffSummary(
      { tags: ["a", "b"] },
      { tags: ["a", "c"] }
    );
    expect(changed).toBe("changed: tags");
  });
});
