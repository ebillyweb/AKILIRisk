import { ClipboardCheck, LineChart, ShieldCheck } from "lucide-react";
import { MarketingSection } from "@/components/marketing/MarketingSection";
import { MarketingSurfaceCard } from "@/components/marketing/MarketingSurfaceCard";

const STEPS = [
  {
    step: "01",
    title: "Structured assessment",
    description:
      "Families complete a guided personal risk profile. Advisors manage intake, scoring, and continuity planning from one workspace.",
    icon: ClipboardCheck,
  },
  {
    step: "02",
    title: "Governance intelligence",
    description:
      "AKILI surfaces profile insights across succession, authority, communication, and ownership — with clear risk prioritization.",
    icon: LineChart,
  },
  {
    step: "03",
    title: "Actionable recommendations",
    description:
      "Receive structured mitigations and advisor-ready guidance so issues are addressed before they become events.",
    icon: ShieldCheck,
  },
] as const;

export function LandingHowItWorks() {
  return (
    <MarketingSection
      id="how-it-works"
      kicker="How it works"
      title="From profile to prioritized action"
      description="A calm, advisory-grade workflow that helps families and advisors see governance risk clearly — then act on it."
    >
      <ol className="grid gap-4 sm:grid-cols-3">
        {STEPS.map(({ step, title, description, icon: Icon }) => (
          <li key={step}>
            <MarketingSurfaceCard className="h-full space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <Icon className="size-5" aria-hidden />
                </div>
                <span className="text-xs font-semibold tabular-nums tracking-widest text-muted-foreground">
                  {step}
                </span>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                <p className="text-sm leading-6 text-muted-foreground">{description}</p>
              </div>
            </MarketingSurfaceCard>
          </li>
        ))}
      </ol>
    </MarketingSection>
  );
}
