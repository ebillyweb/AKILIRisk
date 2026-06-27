import type { ReactNode } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import type { LegalSection } from "@/lib/legal/documents";
import { cn } from "@/lib/utils";

interface MarketingPageProps {
  title: string;
  sections: LegalSection[];
  kicker?: string;
  className?: string;
  children?: ReactNode;
}

export function MarketingPage({
  title,
  sections,
  kicker = "Company",
  className,
  children,
}: MarketingPageProps) {
  return (
    <>
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>
      <main id="main-content" className="min-h-screen pb-10 pt-2 sm:pb-12" tabIndex={-1}>
      <div className="page-shell space-y-10">
        <SiteHeader />
        <div className={cn("mx-auto max-w-3xl space-y-10", className)}>
          <header className="space-y-6">
            <div className="space-y-2">
              <p className="editorial-kicker">{kicker}</p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {title}
              </h1>
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

          {children}

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
