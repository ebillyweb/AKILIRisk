import Link from "next/link";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
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
    <>
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>
      <main id="main-content" className="min-h-screen pb-10 pt-2 sm:pb-12" tabIndex={-1}>
      <div className="page-shell space-y-10">
        <SiteHeader />
        <div className="mx-auto max-w-3xl space-y-10">
          <header className="space-y-6">
            <div className="space-y-2">
              <p className="editorial-kicker">Legal</p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {title}
              </h1>
              <p className="text-sm text-muted-foreground">
                Last updated: {formattedDate}
              </p>
            </div>
          </header>

          <div className="space-y-10">
            {sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-8 space-y-3"
              >
                <h2 className="text-xl font-semibold text-foreground">
                  {section.title}
                </h2>
                <div className="space-y-3">
                  {section.paragraphs.map((paragraph, index) => (
                    <p
                      key={`${section.id}-${index}`}
                      className="text-sm leading-7 text-muted-foreground"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="space-y-8">
            <Link
              href="/"
              className="inline-block text-sm font-semibold text-foreground underline-offset-4 hover:underline"
            >
              Back to home
            </Link>
            <SiteFooter />
          </div>
        </div>
      </div>
    </main>
    </>
  );
}
