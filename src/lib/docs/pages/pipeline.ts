import type { DocsPage } from "@/lib/docs/types";

export const pipelinePage: DocsPage = {
  slug: "pipeline",
  title: "Pipeline",
  description:
    "How the AKILI advisor client pipeline tracks households from invite through assessment and results.",
  audience: "firms",
  hubFeatured: true,
  summary:
    "A single view of client lifecycle stages — invitations, intake, review, assessment, and monitoring.",
  body: [
    {
      type: "paragraph",
      text: "The client pipeline is the firm’s operational view of every household engagement. It replaces ad-hoc status emails with a structured journey across invite, intake, review gates, assessment progress, and follow-up.",
    },
    {
      type: "heading",
      level: 2,
      text: "What you can do",
    },
    {
      type: "list",
      items: [
        "See which clients are waiting on invite acceptance, intake completion, or advisor review.",
        "Open a household to review intake, approve when ready, or restart intake if the engagement needs a reset.",
        "Monitor assessment progress across active risk domains.",
        "Spot households that need attention before risks compound.",
      ],
    },
    {
      type: "heading",
      level: 2,
      text: "Facilitated work",
    },
    {
      type: "paragraph",
      text: "When you guide a household live, use facilitated sessions from the advisor hub alongside the pipeline so progress stays attributed to the correct client record.",
    },
    {
      type: "callout",
      tone: "note",
      title: "Permissions",
      text: "Team roles on Enterprise plans can limit who may invite clients, approve intake, or change methodology. Check Roles & permissions in your firm settings.",
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
          label: "Invitations",
          href: "/docs/invitations",
        },
        {
          label: "Intake interview",
          href: "/docs/intake",
        },
        {
          label: "Assessment",
          href: "/docs/assessment",
        },
      ],
    },
  ],
};
