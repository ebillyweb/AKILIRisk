export type HeroAudience = "families" | "advisors" | "overview";

export const HERO_AUDIENCE_OPTIONS: ReadonlyArray<{
  id: HeroAudience;
  label: string;
}> = [
  { id: "families", label: "For Families" },
  { id: "advisors", label: "For Advisors" },
  { id: "overview", label: "Overview" },
] as const;

export type HeroOverviewStep = {
  step: string;
  title: string;
  description: string;
};

export type HeroAudienceCopy = {
  kicker: string;
  headline: string;
  supporting: string;
  subtext?: string;
  overviewSteps?: ReadonlyArray<HeroOverviewStep>;
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
    kicker: "For families",
    headline:
      "The governance intelligence platform for modern family wealth.",
    supporting:
      "A discreet personal risk profile that surfaces structural gaps and gives your advisor clear, actionable guidance.",
    subtext: "12–15 minute structured assessment",
    primaryCta: {
      label: "Start Assessment",
      href: "/start",
      title: "Start your personal risk profile",
    },
    secondaryCta: {
      label: "Sign In",
      href: "/signin?role=client",
      title: "Sign in to your client account",
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
    kicker: "For advisors",
    headline:
      "Governance intelligence for modern advisory firms.",
    supporting:
      "One workspace for client profiles, assessment progress, risk scoring, and structured recommendations your clients can trust.",
    primaryCta: {
      label: "Advisor Sign In",
      href: "/signin?role=advisor",
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
  overview: {
    kicker: "How it works",
    headline: "Assess. Analyze. Act.",
    supporting:
      "Structured intake across up to ten modular pillars — scoped and weighted per engagement — with prioritized recommendations for families and the advisors who guide them.",
    overviewSteps: [
      {
        step: "1",
        title: "Assess",
        description:
          "Families complete a guided profile. Advisors choose which pillars are in scope and manage intake from one workspace.",
      },
      {
        step: "2",
        title: "Analyze",
        description:
          "Scores across the advisor's active pillars surface succession, authority, cyber, and continuity gaps.",
      },
      {
        step: "3",
        title: "Act",
        description:
          "Structured recommendations help advisors and families address risks before they escalate.",
      },
    ],
    primaryCta: {
      label: "Start Assessment",
      href: "/start",
      title: "Start your personal risk profile",
    },
    secondaryCta: {
      label: "Advisor Sign In",
      href: "/signin?role=advisor",
      title: "Sign in to your advisor workspace",
    },
    helperLinks: [
      {
        id: "pricing",
        content: "link",
        text: "Evaluating for your firm?",
        linkLabel: "View pricing",
        href: "/pricing",
      },
      {
        id: "demo",
        content: "link",
        text: "Want a walkthrough?",
        linkLabel: "Request a demo",
        href: "/contact?intent=demo",
      },
    ],
  },
};
