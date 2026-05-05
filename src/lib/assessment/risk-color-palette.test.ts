import { describe, it, expect } from "vitest";
import {
  RISK_LEVEL_PALETTE,
  paletteForRiskLevel,
  type HeatMapLevel,
} from "./risk-color-palette";

const ALL_LEVELS: HeatMapLevel[] = ["low", "medium", "high", "critical", "unassessed"];

describe("RISK_LEVEL_PALETTE", () => {
  it("has an entry for every level", () => {
    for (const level of ALL_LEVELS) {
      expect(RISK_LEVEL_PALETTE[level]).toBeDefined();
    }
  });

  it("each entry has a complete shape (hex + 3 tailwind classes + label)", () => {
    for (const level of ALL_LEVELS) {
      const p = RISK_LEVEL_PALETTE[level];
      expect(p.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(p.bg).toMatch(/^bg-/);
      expect(p.text).toMatch(/^text-/);
      expect(p.border).toMatch(/^border-/);
      expect(p.label.length).toBeGreaterThan(0);
    }
  });

  it("hex codes are all distinct (no accidental dedupe)", () => {
    const hexes = ALL_LEVELS.map((l) => RISK_LEVEL_PALETTE[l].hex);
    const unique = new Set(hexes);
    expect(unique.size).toBe(ALL_LEVELS.length);
  });

  it("bg classes are all distinct (no accidental dedupe)", () => {
    const bgs = ALL_LEVELS.map((l) => RISK_LEVEL_PALETTE[l].bg);
    const unique = new Set(bgs);
    expect(unique.size).toBe(ALL_LEVELS.length);
  });

  it("HIGH and CRITICAL are visually distinct (not both red)", () => {
    // The whole reason for the canonical palette: pre-refactor HIGH was red
    // in some helpers, making HIGH/CRITICAL hard to tell apart on the heat
    // map. Lock in that the canonical values keep them separable.
    expect(RISK_LEVEL_PALETTE.high.hex).not.toBe(RISK_LEVEL_PALETTE.critical.hex);
    expect(RISK_LEVEL_PALETTE.high.bg).not.toBe(RISK_LEVEL_PALETTE.critical.bg);
  });

  it("unassessed is distinct from all level entries", () => {
    const unassessed = RISK_LEVEL_PALETTE.unassessed;
    for (const level of ["low", "medium", "high", "critical"] as const) {
      expect(unassessed.hex).not.toBe(RISK_LEVEL_PALETTE[level].hex);
      expect(unassessed.bg).not.toBe(RISK_LEVEL_PALETTE[level].bg);
    }
  });
});

describe("paletteForRiskLevel", () => {
  it("returns the matching entry for lowercase inputs", () => {
    expect(paletteForRiskLevel("low")).toBe(RISK_LEVEL_PALETTE.low);
    expect(paletteForRiskLevel("medium")).toBe(RISK_LEVEL_PALETTE.medium);
    expect(paletteForRiskLevel("high")).toBe(RISK_LEVEL_PALETTE.high);
    expect(paletteForRiskLevel("critical")).toBe(RISK_LEVEL_PALETTE.critical);
  });

  it("returns the matching entry for UPPERCASE Prisma-enum inputs", () => {
    expect(paletteForRiskLevel("LOW")).toBe(RISK_LEVEL_PALETTE.low);
    expect(paletteForRiskLevel("MEDIUM")).toBe(RISK_LEVEL_PALETTE.medium);
    expect(paletteForRiskLevel("HIGH")).toBe(RISK_LEVEL_PALETTE.high);
    expect(paletteForRiskLevel("CRITICAL")).toBe(RISK_LEVEL_PALETTE.critical);
  });

  it("returns unassessed for null/undefined/empty", () => {
    expect(paletteForRiskLevel(null)).toBe(RISK_LEVEL_PALETTE.unassessed);
    expect(paletteForRiskLevel(undefined)).toBe(RISK_LEVEL_PALETTE.unassessed);
    expect(paletteForRiskLevel("")).toBe(RISK_LEVEL_PALETTE.unassessed);
  });

  it("returns unassessed for unknown level strings", () => {
    expect(paletteForRiskLevel("severe")).toBe(RISK_LEVEL_PALETTE.unassessed);
    expect(paletteForRiskLevel("not-real")).toBe(RISK_LEVEL_PALETTE.unassessed);
  });
});
