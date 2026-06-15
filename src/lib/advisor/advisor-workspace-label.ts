export type AdvisorUserNameFields = {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

export const DEFAULT_ADVISOR_WORKSPACE_TITLE = "Advisor's Workspace";

export function advisorDisplayName(user: AdvisorUserNameFields): string {
  const fromParts = [user.firstName, user.lastName]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ")
    .trim();
  if (fromParts) return fromParts;

  const fromName = user.name?.trim();
  if (fromName) return fromName;

  return "Advisor";
}

export function advisorWorkspaceTitle(user: AdvisorUserNameFields): string {
  return `${advisorDisplayName(user)}'s Workspace`;
}
