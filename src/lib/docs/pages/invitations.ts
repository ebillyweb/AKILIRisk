import type { DocsPage } from "@/lib/docs/types";

export const invitationsPage: DocsPage = {
  slug: "invitations",
  title: "Invitations",
  description:
    "How firms invite households to AKILI — invite codes, start links, and client onboarding.",
  audience: "firms",
  summary: "Create invite codes and start links so households can begin a personal risk profile.",
  body: [
    {
      type: "paragraph",
      text: "AKILI is professional-led and invitation-only for families. Firms create invitations so each household is tied to the correct advisor relationship from the first click.",
    },
    {
      type: "heading",
      level: 2,
      text: "Creating an invite",
    },
    {
      type: "list",
      items: [
        "Open Invitations from the advisor hub.",
        "Create a new invite for the household email you expect them to use.",
        "Share the invite code or the start link. Families enter the code on Start Assessment.",
        "Confirm the client appears in your pipeline once they begin signup or intake.",
      ],
    },
    {
      type: "heading",
      level: 2,
      text: "What clients experience",
    },
    {
      type: "paragraph",
      text: "Clients receive a magic-link sign-in email (no password). After authenticating, they land in intake or their dashboard depending on progress. If branding is enabled, they may see your firm lockup and portal copy.",
    },
    {
      type: "callout",
      tone: "info",
      title: "Wrong email or lost invite",
      text: "Issue a new invitation or ask the client to use the email on the original invite. Support can help if an account was created under the wrong address.",
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
          label: "Quickstart for firms",
          href: "/docs/quickstart-firms",
        },
        {
          label: "Pipeline",
          href: "/docs/pipeline",
        },
        {
          label: "Quickstart for families",
          href: "/docs/quickstart-families",
          description: "The household side of the same flow.",
        },
      ],
    },
  ],
};
