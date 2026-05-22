import Link from "next/link";
import { AkiliLogoLockup } from "@/components/home/AkiliLogoLockup";
import {
  LEGAL_LAST_UPDATED,
  type LegalSection,
} from "@/lib/legal/documents";
import { cn } from "@/lib/utils";

interface LegalDocumentPageProps {
  title: string;
  sections: LegalSection[];
  lastUpdated?: string;
  otherPolicyHref: "/terms" | "/privacy";
  otherPolicyLabel: string;
}

export function LegalDocumentPage({
  title,
  sections,
  lastUpdated = LEGAL_LAST_UPDATED,
  otherPolicyHref,
  otherPolicyLabel,
}: LegalDocumentPageProps) {
  const formattedDate = new Date(lastUpdated).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <main id="main-content" className="min-h-screen py-6 sm:py-8" tabIndex={-1}>
      <div className="page-shell">
        <div className="mx-auto max-w-3xl space-y-10">
          <header className="space-y-6">
            <Link href="/" className="inline-block text-foreground" aria-label="AKILI home">
              <AkiliLogoLockup className="h-auto w-full max-w-[220px]" />
            </Link>
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

          <footer
            className={cn(
              "flex flex-col gap-4 border-t border-border/70 pt-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
            )}
          >
            <Link
              href="/"
              className="font-semibold text-foreground underline-offset-4 hover:underline"
            >
              Back to home
            </Link>
            <nav className="flex flex-wrap gap-4">
              <Link
                href={otherPolicyHref}
                className="font-semibold text-foreground underline-offset-4 hover:underline"
              >
                {otherPolicyLabel}
              </Link>
            </nav>
          </footer>
        </div>
      </div>
    </main>
  );
}
