import { describe, expect, it } from "vitest";
import { parseAdvisorSettingsTab } from "@/lib/advisor/settings-tabs";

describe("parseAdvisorSettingsTab", () => {
  it("defaults to general", () => {
    expect(parseAdvisorSettingsTab(undefined)).toBe("general");
    expect(parseAdvisorSettingsTab(null)).toBe("general");
    expect(parseAdvisorSettingsTab("")).toBe("general");
    expect(parseAdvisorSettingsTab("unknown")).toBe("general");
    expect(parseAdvisorSettingsTab("branding")).toBe("general");
  });

  it("accepts security", () => {
    expect(parseAdvisorSettingsTab("security")).toBe("security");
  });
});
