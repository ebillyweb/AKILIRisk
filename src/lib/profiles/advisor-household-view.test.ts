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
        notes: null,
        phone: null,
        fullName: null,
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
        notes: null,
        phone: null,
        fullName: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as const satisfies ReadonlyArray<Parameters<typeof toAdvisorHouseholdMemberViews>[0][number]>;

    const views = toAdvisorHouseholdMemberViews([...members]);
    expect(views).toHaveLength(1);
    expect(views[0].displayLabel).toBe("Member A");
  });
});
