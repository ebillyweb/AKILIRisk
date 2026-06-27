import type { ReactNode } from "react";
import { MarketingPageHero } from "@/components/marketing/MarketingPageHero";
import { MarketingProseSections } from "@/components/marketing/MarketingProseSections";
import { PublicPageShell } from "@/components/marketing/PublicPageShell";
import type { LegalSection } from "@/lib/legal/documents";

interface MarketingPageProps {
  title: string;
  sections: LegalSection[];
  kicker?: string;
  heroDescription?: string;
  /** Default stacks content; split places children beside prose (contact form) */
  layout?: "default" | "split";
  /** Cards render sections in a responsive grid; plain uses stacked prose */
  sectionsVariant?: "plain" | "cards";
  className?: string;
  children?: ReactNode;
}

export function MarketingPage({
  title,
  sections,
  kicker = "Company",
  heroDescription,
  layout = "default",
  sectionsVariant = "plain",
  className,
  children,
}: MarketingPageProps) {
  const maxWidth = layout === "split" || sectionsVariant === "cards" ? "wide" : "narrow";

  return (
    <PublicPageShell maxWidth={maxWidth} className={className}>
      <MarketingPageHero
        kicker={kicker}
        title={title}
        description={heroDescription}
      />

      {layout === "split" && children ? (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start lg:gap-12">
          <MarketingProseSections sections={sections} />
          <div className="lg:sticky lg:top-28">{children}</div>
        </div>
      ) : (
        <>
          <MarketingProseSections
            sections={sections}
            variant={sectionsVariant}
          />
          {children}
        </>
      )}
    </PublicPageShell>
  );
}
