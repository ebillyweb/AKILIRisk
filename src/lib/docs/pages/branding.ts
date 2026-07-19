import type { DocsPage } from "@/lib/docs/types";

export const brandingPage: DocsPage = {
  slug: "branding",
  title: "Branding & white-label",
  description:
    "How firms brand the AKILI client experience — logo, portal copy, and subdomain.",
  audience: "firms",
  hubFeatured: true,
  summary:
    "Your brand, your subdomain, your methodology — clients experience your firm, not a generic platform.",
  body: [
    {
      type: "paragraph",
      text: "AKILI supports white-label delivery so professional firms present a coherent branded portal. Clients should recognize your firm first; the underlying platform stays discreet.",
    },
    {
      type: "heading",
      level: 2,
      text: "Branding controls",
    },
    {
      type: "list",
      items: [
        "Upload a firm logo for header and portal lockups.",
        "Edit client-facing copy where branding settings allow.",
        "Enable or disable branding if you prefer the default AKILI presentation.",
      ],
    },
    {
      type: "heading",
      level: 2,
      text: "Subdomains",
    },
    {
      type: "paragraph",
      text: "Firms can claim a tenant subdomain under the AKILI domain (for example on staging or production hosts). After verification and activation, clients use your firm URL for the branded portal experience.",
    },
    {
      type: "callout",
      tone: "info",
      title: "Plan availability",
      text: "White-label subdomain and advanced branding options depend on your subscription tier. Review Pricing or contact sales for Enterprise provisioning.",
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
          label: "Dashboard",
          href: "/docs/dashboard",
          description: "What clients see after sign-in.",
        },
        {
          label: "Pricing",
          href: "/pricing",
        },
      ],
    },
  ],
};
