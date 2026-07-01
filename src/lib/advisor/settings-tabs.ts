export type AdvisorSettingsTab = "general" | "branding" | "security";

export function parseAdvisorSettingsTab(
  value: string | null | undefined,
  options?: { brandingTabVisible?: boolean },
): AdvisorSettingsTab {
  if (value === "branding") {
    return options?.brandingTabVisible === false ? "general" : "branding";
  }
  if (value === "security") return "security";
  return "general";
}
