import type { DocsPage } from "@/lib/docs/types";

export const dashboardPage: DocsPage = {
  slug: "dashboard",
  title: "Dashboard",
  description:
    "How the AKILI client dashboard works — journey tracker, next steps, and portal destinations.",
  audience: "families",
  summary: "Your home base after sign-in: journey status and shortcuts into intake, assessment, and settings.",
  body: [
    {
      type: "paragraph",
      text: "The client dashboard is the home base after magic-link sign-in. It shows where you are in the engagement and where to go next.",
    },
    {
      type: "heading",
      level: 2,
      text: "Journey tracker",
    },
    {
      type: "paragraph",
      text: "Your journey section highlights completed and upcoming steps — typically invite and account, intake, advisor review when required, assessment domains, and results. Use it to confirm whether you are waiting on your firm or have work to finish.",
    },
    {
      type: "heading",
      level: 2,
      text: "Explore your portal",
    },
    {
      type: "list",
      items: [
        "Intake — continue or review the guided interview.",
        "Assessment — open risk domains and results when unlocked.",
        "Documents — download deliverables when your firm shares them.",
        "Profiles & roles — household directory context when enabled.",
        "Settings — email, MFA, and account controls.",
      ],
    },
    {
      type: "callout",
      tone: "note",
      title: "Branded portals",
      text: "If your firm uses a white-label subdomain, you may land on their branded client portal instead of the default AKILI marketing chrome. The same dashboard workflow still applies.",
    },
    {
      type: "heading",
      level: 2,
      text: "Related",
    },
    {
      type: "links",
      items: [
        {
          label: "Assessment",
          href: "/docs/assessment",
        },
        {
          label: "Sign-in & MFA",
          href: "/docs/security",
        },
        {
          label: "Branding & white-label",
          href: "/docs/branding",
          description: "What firms configure for the portal.",
        },
      ],
    },
  ],
};
