import type { DocsPage } from "@/lib/docs/types";

export const intakePage: DocsPage = {
  slug: "intake",
  title: "Intake interview",
  description:
    "How the AKILI guided intake interview works for families — questions, progress, and advisor review.",
  audience: "families",
  hubFeatured: true,
  summary:
    "A guided household profile that prepares the engagement before risk-domain assessments begin.",
  body: [
    {
      type: "paragraph",
      text: "Intake is the first structured conversation in AKILI. It captures household context so your firm can scope the right risk domains and proceed with confidence.",
    },
    {
      type: "heading",
      level: 2,
      text: "What families do",
    },
    {
      type: "list",
      items: [
        "Open Intake from the client dashboard or continue from the invite flow.",
        "Answer questions section by section. Progress saves automatically when you are signed in.",
        "Use audio capture where offered if speaking is easier than typing — transcription supports the written record.",
        "Submit when complete. Your dashboard updates to show review or assessment as the next step.",
      ],
    },
    {
      type: "heading",
      level: 2,
      text: "Advisor review",
    },
    {
      type: "paragraph",
      text: "Depending on how your firm configured the engagement, submitted intake may wait for advisor approval before assessments unlock. Firms can also restart or archive intake when a household needs a fresh start.",
    },
    {
      type: "callout",
      tone: "note",
      title: "Fresh clients",
      text: "If you signed in but see no intake yet, confirm you used the correct invite code and email. Your advisor can resend an invitation from their workspace.",
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
          label: "Quickstart for families",
          href: "/docs/quickstart-families",
        },
        {
          label: "Assessment",
          href: "/docs/assessment",
        },
        {
          label: "Pipeline",
          href: "/docs/pipeline",
          description: "How firms see intake status.",
        },
      ],
    },
  ],
};
