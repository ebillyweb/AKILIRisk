import type { DocsPage } from "@/lib/docs/types";

export const assessmentPage: DocsPage = {
  slug: "assessment",
  title: "Assessment",
  description:
    "How AKILI risk-domain assessments work — progress, scoring context, and results for families.",
  audience: "families",
  hubFeatured: true,
  summary:
    "Modular risk domains scoped by your firm, with progress tracking and prioritized results.",
  body: [
    {
      type: "paragraph",
      text: "After intake (and any required advisor approval), families complete assessments across the risk domains your firm activated for the engagement — up to ten modular pillars such as governance, cyber, succession, tax, reputation, and related areas.",
    },
    {
      type: "heading",
      level: 2,
      text: "Working through domains",
    },
    {
      type: "list",
      items: [
        "Open the Assessment hub from your dashboard to see active domains and completion status.",
        "Answer questions in each section. You can leave and resume; unfinished work remains available.",
        "Submit a domain when you finish its questions. Overall progress updates on your journey tracker.",
      ],
    },
    {
      type: "heading",
      level: 2,
      text: "Results and recommendations",
    },
    {
      type: "paragraph",
      text: "When scoring is available, Assessment Results and your Personal Risk Profile summarize domain scores and structural gaps. Structured recommendations help your professional team prioritize what to address next — AKILI creates a living system of record, not a one-time PDF dump.",
    },
    {
      type: "callout",
      tone: "info",
      title: "Facilitated sessions",
      text: "Some firms run assessments with you in a facilitated session. Your advisor opens the session from their hub; you still answer as the household of record.",
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
          label: "Dashboard",
          href: "/docs/dashboard",
        },
        {
          label: "Intake interview",
          href: "/docs/intake",
        },
        {
          label: "Sign-in & MFA",
          href: "/docs/security",
        },
      ],
    },
  ],
};
