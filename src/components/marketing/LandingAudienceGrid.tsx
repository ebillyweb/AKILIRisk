import { Building2, Landmark, UsersRound } from "lucide-react";
import { MarketingSection } from "@/components/marketing/MarketingSection";
import { MarketingSurfaceCard } from "@/components/marketing/MarketingSurfaceCard";

const AUDIENCES = [
  {
    title: "Family Offices",
    description:
      "Identify governance risks across multi-generational households and complex ownership structures.",
    icon: Landmark,
  },
  {
    title: "Wealth Advisors",
    description:
      "Deliver structured governance guidance alongside financial planning — with client-ready intelligence.",
    icon: Building2,
  },
  {
    title: "Family Leadership",
    description:
      "Strengthen decision frameworks, succession continuity, and accountability across generations.",
    icon: UsersRound,
  },
] as const;

export function LandingAudienceGrid() {
  return (
    <MarketingSection
      id="designed-for"
      kicker="Designed for"
      title="Built for high-trust advisory relationships"
      description="Whether you lead a family, advise one, or operate a family office — AKILI gives you a shared language for governance risk."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {AUDIENCES.map(({ title, description, icon: Icon }) => (
          <MarketingSurfaceCard key={title} className="space-y-4">
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
