import { GovernanceRadarPreview } from "@/components/home/GovernanceRadarPreview";
import { MarketingSection } from "@/components/marketing/MarketingSection";
import { MarketingSurfaceCard } from "@/components/marketing/MarketingSurfaceCard";

const SAMPLE_RISKS = [
  "No defined succession triggers",
  "Informal authority structure",
  "Undocumented governance framework",
] as const;

export function LandingProductPreview() {
  return (
    <MarketingSection
      id="platform-preview"
      kicker="Platform preview"
      title="Governance intelligence at a glance"
      description="Sample output from the AKILI assessment engine — structured scoring, prioritized risks, and advisor-ready context."
    >
      <MarketingSurfaceCard className="overflow-hidden p-0">
        <div className="grid lg:grid-cols-[1fr_1.1fr]">
          <div className="border-b border-border/60 p-6 sm:p-8 lg:border-b-0 lg:border-r">
            <p className="editorial-kicker">AKILI Governance Score</p>
            <p className="mt-3 font-display text-4xl font-semibold tabular-nums text-foreground sm:text-5xl">
              7.2
              <span className="ml-2 text-xl font-normal text-muted-foreground sm:text-2xl">
                / 10
              </span>
            </p>
            <p className="mt-2 text-sm font-medium text-trust-accent">
              Moderate governance exposure
            </p>
            <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
              Composite score across succession, authority, communication, structure,
              and continuity — with pillar-level detail for advisor review.
            </p>
            <div className="mt-8 flex h-40 items-center justify-center sm:h-48">
              <GovernanceRadarPreview className="h-full w-full max-w-[220px] text-brand" />
            </div>
          </div>

          <div className="space-y-6 p-6 sm:p-8">
            <div>
              <p className="editorial-kicker">Top identified risks</p>
              <ul className="mt-4 space-y-3">
                {SAMPLE_RISKS.map((risk, index) => (
                  <li
                    key={risk}
                    className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3 text-sm leading-6 text-muted-foreground"
                  >
                    <span
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-trust-accent/15 text-xs font-semibold tabular-nums text-trust-accent"
                      aria-hidden
                    >
                      {index + 1}
                    </span>
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Illustrative sample data. Actual scores and recommendations are generated
              from each household&apos;s assessment responses.
            </p>
          </div>
        </div>
      </MarketingSurfaceCard>
    </MarketingSection>
  );
}
