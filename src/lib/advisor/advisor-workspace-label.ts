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

/** Map legacy `User.name` into form fields when first/last are unset. */
export function resolveAdvisorPersonalNameFields(user: AdvisorUserNameFields): {
  firstName: string;
  lastName: string;
} {
  const firstName = user.firstName?.trim() ?? "";
  const lastName = user.lastName?.trim() ?? "";
  if (firstName || lastName) {
    return { firstName, lastName };
  }

  const fromName = user.name?.trim();
  if (!fromName) {
    return { firstName: "", lastName: "" };
  }

  const parts = fromName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }
  if (parts.length === 1) {
    return { firstName: parts[0]!, lastName: "" };
  }

  return {
    firstName: parts[0]!,
    lastName: parts.slice(1).join(" "),
  };
}
