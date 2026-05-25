import { describe, it, expect } from "vitest";

import {
  advisorClientDisplayName,
  parseAssignmentFieldVisibility,
  resolveEffectiveFieldVisibility,
} from "./field-visibility";
import { DEFAULT_PII_POLICY } from "./pii-policy";

describe("parseAssignmentFieldVisibility", () => {
  it("defaults every field to false when visibility is null", () => {
    const map = parseAssignmentFieldVisibility(null);
    expect(map["User.name"]).toBe(false);
    expect(map["ClientProfile.phone"]).toBe(false);
  });

  it("reads explicit booleans from the assignment JSON", () => {
    const map = parseAssignmentFieldVisibility({
      "User.name": true,
      "ClientProfile.phone": false,
    });
    expect(map["User.name"]).toBe(true);
    expect(map["ClientProfile.phone"]).toBe(false);
    expect(map["HouseholdMember.notes"]).toBe(false);
  });
});

describe("resolveEffectiveFieldVisibility", () => {
  it("requires both advisor policy and client consent", () => {
    const policy = {
      ...DEFAULT_PII_POLICY,
      fields: { ...DEFAULT_PII_POLICY.fields, "User.name": true },
    };
    const effective = resolveEffectiveFieldVisibility(policy, {
      "User.name": true,
      "ClientProfile.phone": true,
    });
    expect(effective["User.name"]).toBe(true);
    expect(effective["ClientProfile.phone"]).toBe(true);
  });

  it("forces false when advisor policy disables the field", () => {
    const policy = {
      ...DEFAULT_PII_POLICY,
      fields: { ...DEFAULT_PII_POLICY.fields, "ClientProfile.phone": false },
    };
    const effective = resolveEffectiveFieldVisibility(policy, {
      "ClientProfile.phone": true,
    });
    expect(effective["ClientProfile.phone"]).toBe(false);
  });

  it("forces false when client has not consented", () => {
    const effective = resolveEffectiveFieldVisibility(DEFAULT_PII_POLICY, {
      "User.name": false,
    });
    expect(effective["User.name"]).toBe(false);
  });
});

describe("advisorClientDisplayName", () => {
  const allGranted = resolveEffectiveFieldVisibility(DEFAULT_PII_POLICY, {
    "User.name": true,
    "ClientProfile.phone": true,
    "HouseholdMember.fullName": true,
    "HouseholdMember.phone": true,
    "HouseholdMember.notes": true,
  });
  const nameDenied = resolveEffectiveFieldVisibility(DEFAULT_PII_POLICY, {
    "User.name": false,
    "ClientProfile.phone": true,
    "HouseholdMember.fullName": true,
    "HouseholdMember.phone": true,
    "HouseholdMember.notes": true,
  });

  it("returns legal name when User.name is visible", () => {
    expect(
      advisorClientDisplayName("Jane Doe", "jane@example.com", allGranted)
    ).toBe("Jane Doe");
  });

  it("falls back to email when User.name is not visible", () => {
    expect(
      advisorClientDisplayName("Jane Doe", "jane@example.com", nameDenied)
    ).toBe("jane@example.com");
  });
});
