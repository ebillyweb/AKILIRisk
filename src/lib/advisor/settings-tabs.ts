export type AdvisorSettingsTab = "general" | "branding" | "security";

export function parseAdvisorSettingsTab(
  value: string | null | undefined,
): AdvisorSettingsTab {
  if (value === "branding" || value === "security") return value;
  return "general";
}
