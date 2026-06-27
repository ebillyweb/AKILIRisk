import { describe, it, expect } from "vitest";
import {
  RECOMMENDATION_FIELD_POLICIES,
  getRecommendationPolicies,
  validateOverlayFields,
} from "./override-policy";

describe("validateOverlayFields", () => {
  it("rejects PROTECTED field names (name, description, expectedOutcome)", () => {
    const { allowed, rejected } = validateOverlayFields([
      "name",
      "description",
      "expectedOutcome",
      "estimatedCost",
    ]);

    expect(rejected).toEqual(["name", "description", "expectedOutcome"]);
    expect(allowed).toEqual(["estimatedCost"]);
  });

  it("allows CONFIGURABLE fields (estimatedCost, timeframe, provider)", () => {
    const { allowed, rejected } = validateOverlayFields([
      "estimatedCost",
      "timeframe",
      "provider",
      "externalUrl",
      "playbook",
    ]);

    expect(rejected).toHaveLength(0);
    expect(allowed).toEqual([
      "estimatedCost",
      "timeframe",
      "provider",
      "externalUrl",
      "playbook",
    ]);
  });

  it("allows ADDITION fields (notes, prerequisites)", () => {
    const { allowed, rejected } = validateOverlayFields([
      "notes",
      "prerequisites",
    ]);

    expect(rejected).toHaveLength(0);
    expect(allowed).toEqual(["notes", "prerequisites"]);
  });

  it("allows unknown fields not in the policy map", () => {
    const { allowed, rejected } = validateOverlayFields(["customField"]);

    expect(rejected).toHaveLength(0);
    expect(allowed).toEqual(["customField"]);
  });

  it("rejects all PROTECTED fields when mixed with ADDITION fields", () => {
    const { allowed, rejected } = validateOverlayFields([
      "tags",
      "category",
      "icon",
      "notes",
    ]);

    expect(rejected).toEqual(["tags", "category", "icon"]);
    expect(allowed).toEqual(["notes"]);
  });
});

describe("getRecommendationPolicies", () => {
  it("returns correct tier for each known field", () => {
    const policies = getRecommendationPolicies();
    const policyMap = new Map(policies.map((p) => [p.field, p.tier]));

    // Protected fields
    expect(policyMap.get("name")).toBe("PROTECTED");
    expect(policyMap.get("description")).toBe("PROTECTED");
    expect(policyMap.get("expectedOutcome")).toBe("PROTECTED");
    expect(policyMap.get("tags")).toBe("PROTECTED");

    // Configurable fields
    expect(policyMap.get("estimatedCost")).toBe("CONFIGURABLE");
    expect(policyMap.get("timeframe")).toBe("CONFIGURABLE");
    expect(policyMap.get("provider")).toBe("CONFIGURABLE");

    // Addition fields
    expect(policyMap.get("notes")).toBe("ADDITION");
    expect(policyMap.get("prerequisites")).toBe("ADDITION");
  });

  it("returns FieldOverridePolicy[] matching RECOMMENDATION_FIELD_POLICIES count", () => {
    const policies = getRecommendationPolicies();
    expect(policies).toHaveLength(
      Object.keys(RECOMMENDATION_FIELD_POLICIES).length
    );
  });
});
