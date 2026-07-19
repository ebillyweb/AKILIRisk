import type { DocsPage } from "@/lib/docs/types";

export const welcomePage: DocsPage = {
  slug: "",
  title: "Welcome",
  description:
    "How to use AKILI Risk Intelligence — guides for families completing a personal risk profile and firms managing client engagements.",
  audience: "shared",
  summary:
    "Guides for families and professional firms using the AKILI governance intelligence platform.",
  body: [
    {
      type: "paragraph",
      text: "AKILI Risk Intelligence is a governance intelligence platform for modern family wealth. Families complete a structured personal risk profile; professional firms manage intake, scoring, and recommendations from one workspace.",
    },
    {
      type: "paragraph",
      text: "Use this documentation to learn how each part of the platform works — from invite codes and intake through assessment results, pipeline, and firm branding.",
    },
    {
      type: "heading",
      level: 2,
      text: "Where to start",
    },
    {
      type: "links",
      items: [
        {
          label: "Quickstart for families",
          href: "/docs/quickstart-families",
          description: "Invite code, magic link, intake, and assessment.",
        },
        {
          label: "Quickstart for firms",
          href: "/docs/quickstart-firms",
          description: "Advisor signup, invitations, and the client pipeline.",
        },
      ],
    },
  ],
};
