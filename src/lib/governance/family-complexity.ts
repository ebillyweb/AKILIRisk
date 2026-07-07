import type { FamilyComplexity } from "@prisma/client";

export const FAMILY_COMPLEXITY_OPTIONS: {
  value: FamilyComplexity;
  label: string;
  description: string;
}[] = [
  {
    value: "SINGLE_HOUSEHOLD",
    label: "Single household",
    description:
      "One family unit making wealth decisions together—typically parents and children, without extended family or shared operating entities.",
  },
  {
    value: "MULTI_GENERATIONAL",
    label: "Multi-generational",
    description:
      "Two or more generations—such as parents, adult children, or grandparents—share wealth, decisions, or governance responsibilities.",
  },
  {
    value: "FAMILY_BUSINESS_INVOLVED",
    label: "Family business involved",
    description:
      "A family-owned or family-controlled business, partnership, or investment entity is part of your wealth picture.",
  },
];

export function formatFamilyComplexity(value: FamilyComplexity): string {
  return (
    FAMILY_COMPLEXITY_OPTIONS.find((option) => option.value === value)?.label ??
    value.replace(/_/g, " ").toLowerCase()
  );
}
