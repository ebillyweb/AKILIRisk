import { ClipboardCheck, LineChart, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LandingSectionBand } from "@/components/marketing/LandingSectionBand";
import { MarketingSection } from "@/components/marketing/MarketingSection";

const STEPS: ReadonlyArray<{
  step: string;
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    step: "1",
    title: "Assess",
    description:
      "Families complete a guided profile. Advisors manage intake and progress from one workspace.",
    icon: ClipboardCheck,
  },
  {
    step: "2",
    title: "Analyze",
    description:
      "Scores and pillar-level insights surface succession, authority, and continuity gaps.",
    icon: LineChart,
  },
  {
    step: "3",
    title: "Act",
    description:
      "Structured recommendations help advisors and families address risks before they escalate.",
    icon: ShieldCheck,
  },
];

export function LandingHowItWorks() {
  return (
    <LandingSectionBand variant="inset">
      <MarketingSection
        id="how-it-works"
        kicker="How it works"
        title="Assess. Analyze. Act."
        description="A straightforward workflow — from structured intake to advisor-ready guidance."
        className="!space-y-8"
        headerClassName="max-w-2xl"
      >
        <ol className="grid gap-8 md:grid-cols-3 md:gap-6">
          {STEPS.map(({ step, title, description, icon: Icon }, index) => (
            <li key={step} className="relative md:px-2">
              {index < STEPS.length - 1 ? (
                <span
                  className="absolute top-5 hidden h-px bg-border/80 md:block md:left-[calc(50%+1.5rem)] md:w-[calc(100%-3rem)]"
                  aria-hidden
                />
              ) : null}
              <div className="flex flex-col gap-3 md:items-center md:text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background text-sm font-semibold tabular-nums text-foreground shadow-sm">
                  {step}
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand md:mx-auto">
                  <Icon className="size-4" aria-hidden />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">{description}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </MarketingSection>
    </LandingSectionBand>
  );
}
