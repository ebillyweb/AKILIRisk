export type AdvisorSettingsTab = "general" | "security";

export function parseAdvisorSettingsTab(
  value: string | null | undefined,
): AdvisorSettingsTab {
  if (value === "security") return "security";
  return "general";
}
