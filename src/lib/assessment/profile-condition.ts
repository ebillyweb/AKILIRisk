import type { HouseholdProfile } from "@/lib/assessment/personalization";
import {
  ageFromBirthYear,
  hasMultipleGenerations,
  hasSuccessors,
} from "@/lib/assessment/personalization";

type ProfileOperator = "greater_than" | "less_than" | "equals" | "in";

function resolveProfileField(profile: HouseholdProfile | null | undefined, field: string): unknown {
  if (!profile) return undefined;

  switch (field) {
    case "size":
    case "members.length":
      return profile.members.length;
    case "hasMultipleGenerations":
      return hasMultipleGenerations(profile);
    case "hasSuccessors":
      return hasSuccessors(profile);
    case "residentCount":
      return profile.members.filter((m) => m.isResident).length;
    case "governanceRoleCount":
      return profile.members.reduce((n, m) => n + m.governanceRoles.length, 0);
    default:
      if (field.startsWith("members.")) {
        const rest = field.slice("members.".length);
        if (rest === "length") return profile.members.length;
      }
      return undefined;
  }
}

export function evaluateProfileCondition(
  profile: HouseholdProfile | null | undefined,
  field: string,
  operator: ProfileOperator,
  value: unknown
): boolean {
  const actual = resolveProfileField(profile, field);

  if (actual === undefined) {
    return false;
  }

  switch (operator) {
    case "equals":
      return actual === value;
    case "greater_than":
      return Number(actual) > Number(value);
    case "less_than":
      return Number(actual) < Number(value);
    case "in":
      return Array.isArray(value) && value.includes(actual);
    default:
      return false;
  }
}

/** Exposed for tests — derive min/max age across household members. */
export function householdAgeRange(profile: HouseholdProfile): { min: number | null; max: number | null } {
  const ages = profile.members
    .map((m) => ageFromBirthYear(m.birthYear))
    .filter((a): a is number => a != null);
  if (ages.length === 0) return { min: null, max: null };
  return { min: Math.min(...ages), max: Math.max(...ages) };
}
