import { describe, it, expect } from "vitest";
import {
  ariaLabelForCell,
  buildHeatMapCells,
  formatHeatMapScore,
  rowSeverity,
} from "./heat-map-data";
import { starterPillarCatalog } from "@/lib/methodology/pillar-catalog";

const catalog = starterPillarCatalog();

describe("buildHeatMapCells", () => {
  it("returns cells in catalog order", () => {
    const cells = buildHeatMapCells([], { catalog });
    expect(cells.length).toBe(catalog.length);
    expect(cells.map((c) => c.pillarId)).toEqual(catalog.map((p) => p.id));
  });

  it("marks pillars absent from the input as unassessed", () => {
    const cells = buildHeatMapCells([], { catalog });
    for (const c of cells) {
      expect(c.level).toBe("unassessed");
      expect(c.score).toBeNull();
    }
  });

  it("populates pillars present in the input with the right level + score", () => {
    const cells = buildHeatMapCells(
      [
        { pillar: "governance", score: 2.4, riskLevel: "MEDIUM" },
        { pillar: "cyber-digital", score: 0.8, riskLevel: "CRITICAL" },
      ],
      { catalog },
    );
    const gov = cells.find((c) => c.pillarId === "governance")!;
    const cyb = cells.find((c) => c.pillarId === "cyber-digital")!;
    const phys = cells.find((c) => c.pillarId === "physical-security")!;
    expect(gov.level).toBe("medium");
    expect(gov.score).toBe(2.4);
    expect(cyb.level).toBe("critical");
    expect(cyb.score).toBe(0.8);
    expect(phys.level).toBe("unassessed");
    expect(phys.score).toBeNull();
  });

  it("tolerates lowercase risk levels (TS in-app enum)", () => {
    const cells = buildHeatMapCells(
      [{ pillar: "governance", score: 2.6, riskLevel: "low" }],
      { catalog },
    );
    expect(cells[0].level).toBe("low");
  });

  it("falls back to unassessed for unknown level strings", () => {
    const cells = buildHeatMapCells(
      [{ pillar: "governance", score: 2.0, riskLevel: "wrong-level" }],
      { catalog },
    );
    expect(cells[0].level).toBe("unassessed");
  });

  it("treats null riskLevel as unassessed even when score present", () => {
    const cells = buildHeatMapCells(
      [{ pillar: "governance", score: 2.0, riskLevel: null }],
      { catalog },
    );
    expect(cells[0].level).toBe("unassessed");
  });

  it("filters to included pillars when scoped", () => {
    const cells = buildHeatMapCells(
      [
        { pillar: "governance", score: 2.4, riskLevel: "MEDIUM" },
        { pillar: "cyber-digital", score: 0.8, riskLevel: "CRITICAL" },
      ],
      { includedPillarIds: ["governance"], catalog },
    );
    expect(cells).toHaveLength(1);
    expect(cells[0]?.pillarId).toBe("governance");
  });
});

describe("formatHeatMapScore", () => {
  it("formats numbers to 1 decimal /3", () => {
    expect(formatHeatMapScore(2.4)).toBe("2.4 / 3");
    expect(formatHeatMapScore(0)).toBe("0.0 / 3");
    expect(formatHeatMapScore(2.99)).toBe("3.0 / 3");
  });

  it("renders dash for null", () => {
    expect(formatHeatMapScore(null)).toBe("—");
  });
});

describe("ariaLabelForCell", () => {
  it("describes assessed cells with risk level + score", () => {
    const [first] = buildHeatMapCells(
      [{ pillar: "governance", score: 1.8, riskLevel: "MEDIUM" }],
      { catalog },
    );
    expect(ariaLabelForCell(first)).toBe(
      "Governance: medium risk, score 1.8 of 3"
    );
  });

  it("describes unassessed cells without score", () => {
    const [first] = buildHeatMapCells([], { catalog });
    expect(ariaLabelForCell(first)).toBe(`${first.pillarName}: not assessed`);
  });
});

describe("rowSeverity", () => {
  it("returns the max severity across cells (critical wins)", () => {
    const cells = buildHeatMapCells(
      [
        { pillar: "governance", score: 2.5, riskLevel: "low" },
        { pillar: "cyber-digital", score: 0.5, riskLevel: "critical" },
      ],
      { catalog },
    );
    const sev = rowSeverity(cells);
    expect(sev.max).toBe(4); // critical
  });

  it("returns 0 for an all-unassessed row", () => {
    const sev = rowSeverity(buildHeatMapCells([], { catalog }));
    expect(sev.max).toBe(0);
    expect(sev.avg).toBe(0);
  });

  it("avg ignores unassessed cells", () => {
    const cells = buildHeatMapCells(
      [
        { pillar: "governance", score: 2.5, riskLevel: "low" },
        { pillar: "cyber-digital", score: 1.5, riskLevel: "high" },
      ],
      { catalog },
    );
    const sev = rowSeverity(cells);
    expect(sev.avg).toBe((1 + 3) / 2);
  });

  it("two HIGHs beat one HIGH + LOWs by avg tiebreak", () => {
    const a = buildHeatMapCells(
      [
        { pillar: "governance", score: 1.5, riskLevel: "high" },
        { pillar: "cyber-digital", score: 1.5, riskLevel: "high" },
      ],
      { catalog },
    );
    const b = buildHeatMapCells(
      [
        { pillar: "governance", score: 1.5, riskLevel: "high" },
        { pillar: "cyber-digital", score: 2.5, riskLevel: "low" },
        { pillar: "physical-security", score: 2.5, riskLevel: "low" },
      ],
      { catalog },
    );
    const sevA = rowSeverity(a);
    const sevB = rowSeverity(b);
    expect(sevA.max).toBe(sevB.max); // both 3 (HIGH)
    expect(sevA.avg).toBeGreaterThan(sevB.avg); // tiebreak picks A
  });
});
