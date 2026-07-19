export const SUPPORT_TICKET_CATEGORIES = [
  {
    value: "account_access",
    label: "Account & access",
  },
  {
    value: "billing",
    label: "Billing & subscription",
  },
  {
    value: "assessment_intake",
    label: "Assessment or intake",
  },
  {
    value: "technical",
    label: "Technical issue",
  },
  {
    value: "advisor_portal",
    label: "Advisor portal",
  },
  {
    value: "feature_request",
    label: "Feature request",
  },
  {
    value: "other",
    label: "Other",
  },
] as const;

export type SupportTicketCategory =
  (typeof SUPPORT_TICKET_CATEGORIES)[number]["value"];

const CATEGORY_LABELS = Object.fromEntries(
  SUPPORT_TICKET_CATEGORIES.map((category) => [category.value, category.label])
) as Record<SupportTicketCategory, string>;

export function isSupportTicketCategory(
  value: string
): value is SupportTicketCategory {
  return value in CATEGORY_LABELS;
}

export function getSupportTicketCategoryLabel(
  category: SupportTicketCategory
): string {
  return CATEGORY_LABELS[category];
}
