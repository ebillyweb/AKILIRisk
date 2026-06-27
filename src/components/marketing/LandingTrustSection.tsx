import { Lock, Scale, Sparkles } from "lucide-react";
import { MarketingSection } from "@/components/marketing/MarketingSection";
import { MarketingSurfaceCard } from "@/components/marketing/MarketingSurfaceCard";

const TRUST_PILLARS = [
  {
    title: "Advisory-grade discretion",
    description:
      "Private, encrypted responses visible only to assigned advisors. Built for sensitive family governance conversations.",
    icon: Lock,
  },
  {
    title: "Structured methodology",
    description:
      "Not a generic questionnaire — a governed assessment framework across family, cyber, identity, and continuity pillars.",
    icon: Scale,
  },
  {
    title: "Action-oriented output",
    description:
      "Clear scores, prioritized risks, and tailored recommendations — so advisors and families know what to address next.",
    icon: Sparkles,
  },
] as const;

export function LandingTrustSection() {
  return (
    <MarketingSection
      id="trust"
      kicker="Why AKILI"
      title="Trusted where governance matters most"
      description="Sophisticated enough for advisory firms. Clear enough for family leadership. Designed for decisions that outlast a single meeting."
      align="center"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {TRUST_PILLARS.map(({ title, description, icon: Icon }) => (
          <MarketingSurfaceCard key={title} className="space-y-4 text-left">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Icon className="size-5" aria-hidden />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">{title}</h3>
              <p className="text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
          </MarketingSurfaceCard>
        ))}
      </div>
    </MarketingSection>
  );
}
