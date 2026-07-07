import { describe, it, expect } from "vitest";
import { composeAsset, validateOverlayPayload } from "./inheritance-engine";
import type { FieldOverridePolicy } from "./types";

// ---------------------------------------------------------------------------
// Test asset type
// ---------------------------------------------------------------------------

type TestAsset = {
  name: string;
  description: string;
  cost: string;
  timeframe: string;
  provider: string;
  notes: string[];
  prerequisites: string[];
};

function makeAsset(overrides: Partial<TestAsset> = {}): TestAsset {
  return {
    name: "Platform Insight",
    description: "Platform risk finding",
    cost: "$5,000",
    timeframe: "4 weeks",
    provider: "Akili Platform",
    notes: ["Platform note"],
    prerequisites: ["prereq-1"],
    ...overrides,
  };
}

const TEST_POLICIES: FieldOverridePolicy[] = [
  { field: "name", tier: "PROTECTED" },
  { field: "description", tier: "PROTECTED" },
  { field: "cost", tier: "CONFIGURABLE" },
  { field: "timeframe", tier: "CONFIGURABLE" },
  { field: "provider", tier: "CONFIGURABLE" },
  { field: "notes", tier: "ADDITION" },
  { field: "prerequisites", tier: "ADDITION" },
];

// ---------------------------------------------------------------------------
// composeAsset tests
// ---------------------------------------------------------------------------

describe("composeAsset", () => {
  it("returns platform-only values when no overlays are provided", () => {
    const result = composeAsset({ platform: makeAsset() }, TEST_POLICIES);

    expect(result.name).toBe("Platform Insight");
    expect(result.cost).toBe("$5,000");
    expect(result.notes).toEqual(["Platform note"]);
    expect(result.sourceAttribution.name).toBe("PLATFORM");
    expect(result.sourceAttribution.cost).toBe("PLATFORM");
  });

  it("enterprise overrides CONFIGURABLE fields with last-writer-wins", () => {
    const result = composeAsset(
      {
        platform: makeAsset(),
        enterprise: { cost: "$8,000", provider: "Enterprise Partner" },
      },
      TEST_POLICIES
    );

    expect(result.cost).toBe("$8,000");
    expect(result.provider).toBe("Enterprise Partner");
    expect(result.timeframe).toBe("4 weeks"); // inherited from platform
    expect(result.sourceAttribution.cost).toBe("ENTERPRISE");
    expect(result.sourceAttribution.timeframe).toBe("PLATFORM");
  });

  it("advisor overrides win over enterprise for CONFIGURABLE fields", () => {
    const result = composeAsset(
      {
        platform: makeAsset(),
        enterprise: { cost: "$8,000" },
        advisor: { cost: "$10,000" },
      },
      TEST_POLICIES
    );

    expect(result.cost).toBe("$10,000");
    expect(result.sourceAttribution.cost).toBe("ADVISOR");
  });

  it("PROTECTED fields always use platform value regardless of overlays", () => {
    const result = composeAsset(
      {
        platform: makeAsset(),
        enterprise: { name: "Enterprise Override" as string },
        advisor: { name: "Advisor Override" as string, description: "Advisor desc" },
      },
      TEST_POLICIES
    );

    expect(result.name).toBe("Platform Insight");
    expect(result.description).toBe("Platform risk finding");
    expect(result.sourceAttribution.name).toBe("PLATFORM");
    expect(result.sourceAttribution.description).toBe("PLATFORM");
  });

  it("ADDITION fields concatenate arrays from all layers", () => {
    const result = composeAsset(
      {
        platform: makeAsset(),
        enterprise: { notes: ["Enterprise note"] as string[] },
        advisor: { notes: ["Advisor note"] as string[] },
      },
      TEST_POLICIES
    );

    expect(result.notes).toEqual([
      "Platform note",
      "Enterprise note",
      "Advisor note",
    ]);
  });

  it("ADDITION fields with only platform array remain unchanged", () => {
    const result = composeAsset(
      {
        platform: makeAsset({ prerequisites: ["a", "b"] }),
      },
      TEST_POLICIES
    );

    expect(result.prerequisites).toEqual(["a", "b"]);
    expect(result.sourceAttribution.prerequisites).toBe("PLATFORM");
  });

  it("inactive (null) layers are ignored", () => {
    const result = composeAsset(
      {
        platform: makeAsset(),
        enterprise: null,
        advisor: null,
      },
      TEST_POLICIES
    );

    expect(result.cost).toBe("$5,000");
    expect(result.sourceAttribution.cost).toBe("PLATFORM");
  });

  it("fields not in policy default to CONFIGURABLE behavior", () => {
    type Extended = TestAsset & { extraField: string };
    const platform: Extended = { ...makeAsset(), extraField: "platform-val" };

    const result = composeAsset(
      {
        platform,
        advisor: { extraField: "advisor-val" } as Partial<Extended>,
      },
      TEST_POLICIES // extraField not in policies
    );

    expect(result.extraField).toBe("advisor-val");
    expect(result.sourceAttribution.extraField).toBe("ADVISOR");
  });

  it("sourceAttribution tracks highest contributing layer for ADDITION fields", () => {
    const result = composeAsset(
      {
        platform: makeAsset({ notes: [] }),
        enterprise: { notes: ["ent-note"] as string[] },
      },
      TEST_POLICIES
    );

    expect(result.notes).toEqual(["ent-note"]);
    expect(result.sourceAttribution.notes).toBe("ENTERPRISE");
  });
});

// ---------------------------------------------------------------------------
// validateOverlayPayload tests
// ---------------------------------------------------------------------------

describe("validateOverlayPayload", () => {
  it("rejects writes to PROTECTED fields", () => {
    const { allowed, rejected } = validateOverlayPayload(
      ["name", "cost", "description"],
      TEST_POLICIES
    );

    expect(rejected).toEqual(["name", "description"]);
    expect(allowed).toEqual(["cost"]);
  });

  it("allows CONFIGURABLE and ADDITION fields", () => {
    const { allowed, rejected } = validateOverlayPayload(
      ["cost", "timeframe", "notes", "prerequisites"],
      TEST_POLICIES
    );

    expect(rejected).toHaveLength(0);
    expect(allowed).toEqual(["cost", "timeframe", "notes", "prerequisites"]);
  });

  it("allows unknown fields (not in policy)", () => {
    const { allowed, rejected } = validateOverlayPayload(
      ["unknownField"],
      TEST_POLICIES
    );

    expect(rejected).toHaveLength(0);
    expect(allowed).toEqual(["unknownField"]);
  });
});
