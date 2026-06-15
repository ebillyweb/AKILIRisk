export type HeroAudience = "families" | "advisors";

export const HERO_AUDIENCE_OPTIONS: ReadonlyArray<{
  id: HeroAudience;
  label: string;
}> = [
  { id: "families", label: "For Families" },
  { id: "advisors", label: "For Advisors" },
] as const;

export type HeroAudienceCopy = {
  kicker: string;
  headline: string;
  supporting: string;
  subtext?: string;
  primaryCta: { label: string; href: string; title: string };
  secondaryCta: { label: string; href: string; title: string };
  helperLinks: ReadonlyArray<{
    id: string;
    content: "link" | "text";
    text: string;
    href?: string;
    linkLabel?: string;
  }>;
};

export const HERO_AUDIENCE_CONTENT: Record<HeroAudience, HeroAudienceCopy> = {
  families: {
    kicker: "Personal Risk Profile",
    headline:
      "The governance intelligence platform for modern family wealth.",
    supporting:
      "A discreet digital personal risk profile designed to identify structural risks and strengthen family decision frameworks.",
    subtext: "12–15 minute personal risk profile",
    primaryCta: {
      label: "Start Assessment",
      href: "/start",
      title: "Start your personal risk profile",
    },
    secondaryCta: {
      label: "Sign In with Email Link",
      href: "/signin/magic-link",
      title: "Request a one-time sign-in link by email",
    },
    helperLinks: [
      {
        id: "advisor-review",
        content: "link",
        text: "Looking for an advisor?",
        linkLabel: "Request a review",
        href: "/request-review",
      },
      {
        id: "privacy",
        content: "text",
        text: "Private and encrypted. Responses visible only to your advisor.",
      },
    ],
  },
  advisors: {
    kicker: "Advisor's Workspace",
    headline:
      "A personal and intentional way to assess your clients' vulnerabilities.",
    supporting:
      "Manage personal risk profiles, client intelligence, succession planning, and structured recommendations from a unified advisor workspace.",
    primaryCta: {
      label: "Advisor Sign In",
      href: "/signin?portal=advisor",
      title: "Sign in to your advisor workspace",
    },
    secondaryCta: {
      label: "Request Demo",
      href: "/contact?intent=demo",
      title: "Request a platform demonstration",
    },
    helperLinks: [
      {
        id: "platform-admin",
        content: "link",
        text: "Platform administrator?",
        linkLabel: "Sign in with password",
        href: "/signin",
      },
      {
        id: "family-path",
        content: "link",
        text: "Assessing as a family?",
        linkLabel: "Start assessment",
        href: "/start",
      },
      {
        id: "workspace",
        content: "text",
        text: "Secure workspace for client governance profiles, scoring, and continuity planning.",
      },
    ],
  },
};
