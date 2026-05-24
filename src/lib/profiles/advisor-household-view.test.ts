import { describe, it, expect } from "vitest";
import { toAdvisorHouseholdMemberViews } from "@/lib/profiles/advisor-household-view";

describe("toAdvisorHouseholdMemberViews", () => {
  it("excludes members with shareWithAdvisor false", () => {
    const members = [
      {
        id: "1",
        userId: "u1",
        displayLabel: "Member A",
        birthYear: 1980,
        sex: "MALE",
        relationship: "SPOUSE",
        governanceRoles: ["DECISION_MAKER"],
        isResident: true,
        shareWithAdvisor: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "2",
        userId: "u1",
        displayLabel: "Member B",
        birthYear: 2005,
        sex: "FEMALE",
        relationship: "CHILD",
        governanceRoles: [],
        isResident: true,
        shareWithAdvisor: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as const;

    const views = toAdvisorHouseholdMemberViews([...members]);
    expect(views).toHaveLength(1);
    expect(views[0].displayLabel).toBe("Member A");
  });
});
