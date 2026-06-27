import { Building2, Landmark, Lock, Scale, Sparkles, UsersRound } from "lucide-react";
import { MarketingSection } from "@/components/marketing/MarketingSection";

const AUDIENCES = [
  {
    title: "Family offices",
    description: "Multi-generational governance across complex ownership.",
    icon: Landmark,
  },
  {
    title: "Wealth advisors",
    description: "Client-ready intelligence alongside financial planning.",
    icon: Building2,
  },
  {
    title: "Family leadership",
    description: "Clear frameworks for succession and decision-making.",
    icon: UsersRound,
  },
] as const;

const TRUST_POINTS = [
  { title: "Private by design", description: "Encrypted responses, advisor-only visibility.", icon: Lock },
  { title: "Structured methodology", description: "Governed pillars — not a generic survey.", icon: Scale },
  { title: "Action-oriented", description: "Prioritized risks and tailored recommendations.", icon: Sparkles },
] as const;

export function LandingOutcomesSection() {
  return (
    <MarketingSection
      id="who-its-for"
      kicker="Who it's for"
      title="One platform for families and the advisors who guide them"
      description="AKILI gives both sides a shared view of governance risk — discreet for clients, structured for advisory firms."
      className="!space-y-10"
    >
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="space-y-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Built for
          </p>
          <ul className="space-y-4">
            {AUDIENCES.map(({ title, description, icon: Icon }) => (
              <li key={title} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <Icon className="size-4" aria-hidden />
                </div>
                <div className="space-y-0.5 pt-0.5">
                  <p className="font-semibold text-foreground">{title}</p>
                  <p className="text-sm leading-6 text-muted-foreground">{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-5 border-t border-border/60 pt-8 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-16">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Why advisors trust AKILI
          </p>
          <ul className="space-y-4">
            {TRUST_POINTS.map(({ title, description, icon: Icon }) => (
              <li key={title} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <Icon className="size-4" aria-hidden />
                </div>
                <div className="space-y-0.5 pt-0.5">
                  <p className="font-semibold text-foreground">{title}</p>
                  <p className="text-sm leading-6 text-muted-foreground">{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </MarketingSection>
  );
}
