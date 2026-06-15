import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  ListChecks,
  MessagesSquare,
  ScanSearch,
  UserRound,
  Users,
} from "lucide-react";

export type HomeHeroFeature = {
  title: string;
  description: string;
  icon: LucideIcon;
};

/** Bottom-left feature cards — Families homepage tab only. */
export const HOME_HERO_FEATURES: ReadonlyArray<HomeHeroFeature> = [
  {
    title: "Advisor Led",
    description:
      "A structured interview designed for families and their advisors.",
    icon: MessagesSquare,
  },
  {
    title: "Risk Identification",
    description: "Surface concerns before they become events.",
    icon: ScanSearch,
  },
  {
    title: "Personal Recommendations",
    description:
      "Receive tailored recommendations for your family's needs.",
    icon: ListChecks,
  },
];

/** Bottom-left feature cards — Advisors homepage tab only. */
export const ADVISOR_HERO_FEATURES: ReadonlyArray<HomeHeroFeature> = [
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
];
