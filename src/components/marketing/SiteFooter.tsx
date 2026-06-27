import Link from "next/link";
import { AkiliLogoLockup } from "@/components/home/AkiliLogoLockup";
import { LEGAL_ENTITY_NAME } from "@/lib/legal/documents";
import { SITE_NAV_LINKS } from "@/lib/marketing/site-nav";
import { cn } from "@/lib/utils";

interface SiteFooterProps {
  className?: string;
}

export function SiteFooter({ className }: SiteFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      className={cn(
        "mt-16 border-t border-border/70 pt-10 text-sm text-muted-foreground",
        className,
      )}
    >
      <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr_1fr]">
        <div className="space-y-4">
          <Link href="/" className="inline-block text-foreground" aria-label="AKILI home">
            <AkiliLogoLockup className="h-auto w-full max-w-[160px]" />
          </Link>
          <p className="max-w-sm text-sm leading-6">
            Governance intelligence for modern families and advisory firms — structured
            assessments, prioritized risks, and actionable recommendations.
          </p>
        </div>

        <div className="space-y-3">
          <p className="editorial-kicker">Platform</p>
          <nav className="flex flex-col gap-2" aria-label="Platform links">
            {SITE_NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="font-medium text-foreground/90 underline-offset-4 hover:text-foreground hover:underline"
              >
                {label}
              </Link>
            ))}
            <Link
              href="/start"
              className="font-medium text-foreground/90 underline-offset-4 hover:text-foreground hover:underline"
            >
              Start assessment
            </Link>
            <Link
              href="/signin/magic-link"
              className="font-medium text-foreground/90 underline-offset-4 hover:text-foreground hover:underline"
            >
              Client sign in
            </Link>
            <Link
              href="/signin?portal=advisor"
              className="font-medium text-foreground/90 underline-offset-4 hover:text-foreground hover:underline"
            >
              Advisor sign in
            </Link>
          </nav>
        </div>

        <div className="space-y-3">
          <p className="editorial-kicker">Legal</p>
          <nav className="flex flex-col gap-2" aria-label="Legal links">
            <Link
              href="/privacy"
              className="font-medium text-foreground/90 underline-offset-4 hover:text-foreground hover:underline"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="font-medium text-foreground/90 underline-offset-4 hover:text-foreground hover:underline"
            >
              Terms of Service
            </Link>
          </nav>
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-3 border-t border-border/60 pt-6 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <p>
          &copy; {year} {LEGAL_ENTITY_NAME}. All rights reserved.
        </p>
        <p className="text-xs leading-5">
          Built for the advisory process used by AKILI Risk Intelligence.
        </p>
      </div>
    </footer>
  );
}
