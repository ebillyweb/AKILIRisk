import type { DocsPage } from "@/lib/docs/types";

export const quickstartFamiliesPage: DocsPage = {
  slug: "quickstart-families",
  title: "Quickstart for families",
  description:
    "Start your AKILI personal risk profile — invite code, magic-link sign-in, intake interview, and assessment.",
  audience: "families",
  summary: "From invite code to a completed personal risk profile in a few guided steps.",
  body: [
    {
      type: "paragraph",
      text: "AKILI is invitation-only for households. Your professional firm (wealth advisor, CPA, estate attorney, or family office) sends an invite so your responses stay private to your assigned team.",
    },
    {
      type: "steps",
      items: [
        {
          title: "Open Start Assessment",
          body: "Go to Start Assessment on the public site and enter the invite code your firm provided. If you do not have a code, ask your advisor or use Request a review.",
        },
        {
          title: "Create or confirm your account",
          body: "Household clients sign in with a magic link sent to email — no password. Check your inbox (and spam) for the secure link.",
        },
        {
          title: "Complete intake",
          body: "Answer the guided intake interview. You can pause and return; progress is saved to your account.",
        },
        {
          title: "Wait for advisor review when required",
          body: "Some engagements require your firm to review and approve intake before risk-domain assessments unlock. Your dashboard shows the next step.",
        },
        {
          title: "Complete active risk domains",
          body: "Work through the assessment sections your firm scoped for this engagement. When finished, review results and any action plan items from your portal.",
        },
      ],
    },
    {
      type: "callout",
      tone: "note",
      title: "Privacy",
      text: "Responses are encrypted and visible only to your assigned professional. AKILI does not publish household data publicly.",
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
          label: "Intake interview",
          href: "/docs/intake",
          description: "How the guided profile works.",
        },
        {
          label: "Assessment",
          href: "/docs/assessment",
          description: "Risk domains, progress, and results.",
        },
        {
          label: "Dashboard",
          href: "/docs/dashboard",
          description: "Your home base after sign-in.",
        },
      ],
    },
  ],
};
