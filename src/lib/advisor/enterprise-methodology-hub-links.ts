/** Firm standards hub cards — shared by hub page and tests. */
export const ENTERPRISE_METHODOLOGY_HUB_LINKS = [
  {
    href: "/advisor/enterprise/methodology/risk-domains",
    title: "Risk domain manager",
    description:
      "Toggle risk domains, rename labels, set weights and score thresholds for the firm.",
  },
  {
    href: "/advisor/enterprise/methodology/intake",
    title: "Intake question bank",
    description: "Platform intake by default; optional combined or custom-only banks for the firm.",
  },
  {
    href: "/advisor/enterprise/methodology/narratives/governance",
    title: "Risk domain narratives",
    description:
      "Customize outcome copy for low, mid, and high maturity bands firm-wide.",
  },
  {
    href: "/advisor/enterprise/recommendations/governance",
    title: "Recommendation rules",
    description: "Configure service triggers per risk domain for the whole firm.",
  },
] as const;

export const ENTERPRISE_METHODOLOGY_QUESTION_PATH = (pillarSlug: string) =>
  `/advisor/enterprise/methodology/questions/${pillarSlug}`;
