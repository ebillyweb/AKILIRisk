import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  Waypoints,
} from "lucide-react";

export type HeroAudience = "families" | "advisors";

export const HERO_AUDIENCE_OPTIONS: ReadonlyArray<{
  id: HeroAudience;
  label: string;
}> = [
  { id: "families", label: "For Families" },
  { id: "advisors", label: "For Advisors" },
] as const;

export type HeroFeature = {
  title: string;
  description: string;
  icon: LucideIcon;
};

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
  features: ReadonlyArray<HeroFeature>;
};

export const HERO_AUDIENCE_CONTENT: Record<HeroAudience, HeroAudienceCopy> = {
  families: {
    kicker: "Governance Assessment",
    headline:
      "The governance intelligence platform for modern family wealth.",
    supporting:
      "A discreet digital governance assessment designed to identify structural risks and strengthen family decision frameworks.",
    subtext: "12–15 minute governance assessment",
    primaryCta: {
      label: "Start Assessment",
      href: "/start",
      title: "Start your governance assessment",
    },
    secondaryCta: {
      label: "Sign In",
      href: "/signin",
      title: "Sign in to continue your assessment",
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
    features: [
      {
        title: "Governance Risk Identification",
        description:
          "Surface structural governance gaps before they become disputes.",
        icon: ShieldCheck,
      },
      {
        title: "Advisor-Guided Assessment",
        description:
          "A structured interview designed for families and their advisors.",
        icon: Waypoints,
      },
      {
        title: "Continuity Intelligence",
        description:
          "Receive governance recommendations and succession frameworks.",
        icon: Sparkles,
      },
    ],
  },
  advisors: {
    kicker: "Advisor Workspace",
    headline: "Governance intelligence for modern advisory firms.",
    supporting:
      "Manage governance assessments, client intelligence, succession planning, and structured recommendations from a unified advisor workspace.",
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
    features: [
      {
        title: "Client Governance Profiles",
        description:
          "Centralize household governance context, intake, and assessment progress.",
        icon: Users,
      },
      {
        title: "Risk Scoring & Recommendations",
        description:
          "Translate assessment outcomes into structured, advisor-ready guidance.",
        icon: BarChart3,
      },
      {
        title: "Family Continuity Planning",
        description:
          "Support succession frameworks and long-horizon continuity decisions.",
        icon: UserRound,
      },
    ],
  },
};
