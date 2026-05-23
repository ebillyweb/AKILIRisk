import { describe, expect, it } from "vitest";
import { evaluateProfileCondition } from "@/lib/assessment/profile-condition";
import type { HouseholdProfile } from "@/lib/assessment/personalization";

describe("evaluateProfileCondition", () => {
  const profile: HouseholdProfile = {
    members: [
      {
        id: "1",
        displayLabel: "Parent",
        birthYear: 1970,
        sex: null,
        relationship: "SELF",
        governanceRoles: ["TRUSTEE"],
        isResident: true,
      },
      {
        id: "2",
        displayLabel: "Child",
        birthYear: 2005,
        sex: null,
        relationship: "CHILD",
        governanceRoles: [],
        isResident: true,
      },
    ],
  };

  it("evaluates members.length with greater_than", () => {
    expect(
      evaluateProfileCondition(profile, "members.length", "greater_than", 1)
    ).toBe(true);
  });

  it("returns false when profile is missing", () => {
    expect(
      evaluateProfileCondition(null, "members.length", "greater_than", 0)
    ).toBe(false);
  });
});
