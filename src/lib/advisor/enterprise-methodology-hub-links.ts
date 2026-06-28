/** Firm methodology hub cards — shared by hub page and tests. */
export const ENTERPRISE_METHODOLOGY_HUB_LINKS = [
  {
    href: "/advisor/enterprise/methodology/pillars",
    title: "Pillar manager",
    description:
      "Toggle pillars, rename labels, set weights and score thresholds for the firm.",
  },
  {
    href: "/advisor/enterprise/methodology/intake",
    title: "Intake script",
    description: "Edit the ordered audio interview script inherited by all firm advisors.",
  },
  {
    href: "/advisor/enterprise/methodology/narratives/governance",
    title: "Pillar narratives",
    description:
      "Customize outcome copy for low, mid, and high maturity bands firm-wide.",
  },
  {
    href: "/advisor/enterprise/recommendations/governance",
    title: "Recommendation rules",
    description: "Configure service triggers per pillar for the whole firm.",
  },
] as const;

export const ENTERPRISE_METHODOLOGY_QUESTION_PATH = (pillarSlug: string) =>
  `/advisor/enterprise/methodology/questions/${pillarSlug}`;
