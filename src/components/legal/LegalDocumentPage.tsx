import { MarketingPageHero } from "@/components/marketing/MarketingPageHero";
import { MarketingProseSections } from "@/components/marketing/MarketingProseSections";
import { PublicPageShell } from "@/components/marketing/PublicPageShell";
import {
  LEGAL_LAST_UPDATED,
  type LegalSection,
} from "@/lib/legal/documents";

interface LegalDocumentPageProps {
  title: string;
  sections: LegalSection[];
  lastUpdated?: string;
}

export function LegalDocumentPage({
  title,
  sections,
  lastUpdated = LEGAL_LAST_UPDATED,
}: LegalDocumentPageProps) {
  const formattedDate = new Date(lastUpdated).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <PublicPageShell maxWidth="narrow">
      <MarketingPageHero
        kicker="Legal"
        title={title}
        meta={
          <p className="text-sm text-muted-foreground">
            Last updated: {formattedDate}
          </p>
        }
      />
      <MarketingProseSections sections={sections} />
    </PublicPageShell>
  );
}
