import { describe, expect, it } from "vitest";

import {
  advisorDisplayName,
  advisorWorkspaceTitle,
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
