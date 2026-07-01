import { describe, expect, it } from "vitest";
import { parseAdvisorSettingsTab } from "@/lib/advisor/settings-tabs";

describe("parseAdvisorSettingsTab", () => {
  it("defaults to general", () => {
    expect(parseAdvisorSettingsTab(undefined)).toBe("general");
    expect(parseAdvisorSettingsTab(null)).toBe("general");
    expect(parseAdvisorSettingsTab("")).toBe("general");
    expect(parseAdvisorSettingsTab("unknown")).toBe("general");
  });

  it("accepts branding and security", () => {
    expect(parseAdvisorSettingsTab("branding")).toBe("branding");
    expect(parseAdvisorSettingsTab("security")).toBe("security");
  });

  it("maps branding to general when the branding tab is hidden", () => {
    expect(parseAdvisorSettingsTab("branding", { brandingTabVisible: false })).toBe(
      "general",
    );
  });
});
