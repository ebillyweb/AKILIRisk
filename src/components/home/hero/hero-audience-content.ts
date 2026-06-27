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
    kicker: "Governance intelligence",
    headline:
      "The governance intelligence platform for modern family wealth.",
    supporting:
      "Surface profile insights, identify structural risks, and receive tailored recommendations — through a discreet personal risk profile your advisor can act on.",
    subtext: "12–15 minute structured assessment",
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
        text: "Don't have an invite code?",
        linkLabel: "Request a review",
        href: "/request-review",
      },
      {
        id: "privacy",
        content: "text",
        text: "Private and encrypted. Responses visible only to your assigned advisor.",
      },
    ],
  },
  advisors: {
    kicker: "Advisor workspace",
    headline:
      "Governance intelligence for modern advisory firms.",
    supporting:
      "Manage client governance profiles, assessment progress, risk scoring, and structured recommendations from one secure advisor workspace.",
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
        id: "pricing",
        content: "link",
        text: "New to AKILI?",
        linkLabel: "View pricing",
        href: "/pricing",
      },
      {
        id: "signup",
        content: "link",
        text: "Ready to subscribe?",
        linkLabel: "Create advisor account",
        href: "/signup/advisor",
      },
      {
        id: "family-path",
        content: "link",
        text: "Assessing as a family?",
        linkLabel: "Start assessment",
        href: "/start",
      },
    ],
  },
};
