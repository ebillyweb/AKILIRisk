import type { DocsPage } from "@/lib/docs/types";

export const quickstartFirmsPage: DocsPage = {
  slug: "quickstart-firms",
  title: "Quickstart for firms",
  description:
    "Get your firm running on AKILI — advisor account, client invitations, pipeline, and branding.",
  audience: "firms",
  summary: "Stand up your advisor workspace and invite the first household.",
  body: [
    {
      type: "paragraph",
      text: "Professional firms use AKILI as a white-label governance workspace: client profiles, intake, assessment progress, scoring, and structured recommendations in one place.",
    },
    {
      type: "steps",
      items: [
        {
          title: "Create an advisor account",
          body: "Register at Advisor signup, or sign in if you already subscribe. Advisors use email and password (not magic link).",
        },
        {
          title: "Review your plan and modules",
          body: "Open Pricing or Billing in the advisor hub to confirm which risk domains and client limits apply to your subscription.",
        },
        {
          title: "Invite a household",
          body: "From Invitations, create an invite and share the code (or branded start link) with the family. They begin at Start Assessment.",
        },
        {
          title: "Track progress in the pipeline",
          body: "The client pipeline shows intake status, review gates, assessment progress, and next actions across your book.",
        },
        {
          title: "Apply firm branding (optional)",
          body: "Upload your logo, set portal copy, and claim a subdomain so clients experience your firm — not a generic platform.",
        },
      ],
    },
    {
      type: "callout",
      tone: "info",
      title: "Enterprise teams",
      text: "Multi-advisor firms can add team members, practice standards, and methodology customization on Enterprise plans. Contact sales if you need provisioning help.",
    },
    {
      type: "heading",
      level: 2,
      text: "Next guides",
    },
    {
      type: "links",
      items: [
        {
          label: "Invitations",
          href: "/docs/invitations",
          description: "Invite codes and client onboarding.",
        },
        {
          label: "Pipeline",
          href: "/docs/pipeline",
          description: "Track households through the engagement.",
        },
        {
          label: "Branding & white-label",
          href: "/docs/branding",
          description: "Logo, subdomain, and client portal.",
        },
      ],
    },
  ],
};
