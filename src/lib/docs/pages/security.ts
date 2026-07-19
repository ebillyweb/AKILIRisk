import type { DocsPage } from "@/lib/docs/types";

export const securityPage: DocsPage = {
  slug: "security",
  title: "Sign-in & MFA",
  description:
    "How sign-in works on AKILI for families and firms, including magic links, passwords, and MFA.",
  audience: "shared",
  summary: "Magic links for families, passwords for firms, and optional MFA for stronger account protection.",
  body: [
    {
      type: "paragraph",
      text: "AKILI uses role-appropriate authentication. Household clients never need a password; advisors and admins use email and password with optional multi-factor authentication.",
    },
    {
      type: "heading",
      level: 2,
      text: "Families (clients)",
    },
    {
      type: "list",
      items: [
        "Sign in at Client sign-in with your email.",
        "Open the magic link from your inbox. Links expire for security — request a new one if needed.",
        "Enable MFA from Settings when you want an extra verification step on sensitive sessions.",
      ],
    },
    {
      type: "heading",
      level: 2,
      text: "Firms (advisors)",
    },
    {
      type: "list",
      items: [
        "Sign in at Advisor sign-in with email and password.",
        "Use account recovery flows if you forget your password.",
        "Turn on MFA from Settings and store recovery codes offline.",
      ],
    },
    {
      type: "callout",
      tone: "note",
      title: "Data handling",
      text: "Assessment responses are treated as confidential household information visible to the assigned professional relationship. See the Privacy Policy for formal terms.",
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
          label: "Quickstart for firms",
          href: "/docs/quickstart-firms",
        },
        {
          label: "Privacy Policy",
          href: "/privacy",
        },
      ],
    },
  ],
};
