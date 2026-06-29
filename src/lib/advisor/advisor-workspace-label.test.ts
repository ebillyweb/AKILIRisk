import { describe, expect, it } from "vitest";

import {
  advisorDisplayName,
  advisorWorkspaceTitle,
  resolveAdvisorPersonalNameFields,
} from "@/lib/advisor/advisor-workspace-label";

describe("advisorWorkspaceTitle", () => {
  it("uses first and last name when available", () => {
    expect(
      advisorWorkspaceTitle({ firstName: "Justin", lastName: "Butler" })
    ).toBe("Justin Butler's Workspace");
  });

  it("falls back to name then Advisor", () => {
    expect(advisorWorkspaceTitle({ name: "Justin Butler" })).toBe(
      "Justin Butler's Workspace"
    );
    expect(advisorDisplayName({})).toBe("Advisor");
    expect(advisorWorkspaceTitle({})).toBe("Advisor's Workspace");
  });
});

describe("resolveAdvisorPersonalNameFields", () => {
  it("prefers first and last name columns", () => {
    expect(
      resolveAdvisorPersonalNameFields({
        firstName: "Justin",
        lastName: "Butler",
        name: "Legacy Name",
      }),
    ).toEqual({ firstName: "Justin", lastName: "Butler" });
  });

  it("splits legacy name when first and last are empty", () => {
    expect(resolveAdvisorPersonalNameFields({ name: "Buddy Jamahl" })).toEqual({
      firstName: "Buddy",
      lastName: "Jamahl",
    });
  });

  it("returns empty strings when no name data exists", () => {
    expect(resolveAdvisorPersonalNameFields({})).toEqual({
      firstName: "",
      lastName: "",
    });
  });
});
