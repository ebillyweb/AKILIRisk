import Link from "next/link";
import { AkiliLogoLockup } from "@/components/home/AkiliLogoLockup";
import { SiteBusinessContact } from "@/components/marketing/SiteBusinessContact";
import { SiteSocialLinks } from "@/components/marketing/SiteSocialLinks";
import { LEGAL_ENTITY_NAME } from "@/lib/legal/documents";
import {
  SITE_AUDIENCE_NAV,
  SITE_PRIMARY_NAV_LINKS,
  SITE_SECONDARY_NAV_LINKS,
  audienceNavHref,
} from "@/lib/marketing/site-nav";
import { cn } from "@/lib/utils";

interface SiteFooterProps {
  className?: string;
}

const linkClassName =
  "font-medium text-foreground/90 underline-offset-4 transition-colors duration-200 hover:text-foreground hover:underline";

export function SiteFooter({ className }: SiteFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      className={cn(
        "mt-12 border-t border-border/70 pt-8 pb-6 text-sm text-muted-foreground sm:mt-16 sm:pt-10 sm:pb-0",
        className,
      )}
    >
      <div className="grid gap-8 sm:gap-10 lg:grid-cols-[1.2fr_1fr_1fr] lg:gap-10">
        <div className="space-y-3 sm:space-y-4">
          <Link href="/" className="inline-block text-foreground" aria-label="AKILI home">
            <AkiliLogoLockup className="h-auto w-full max-w-[140px] sm:max-w-[160px]" />
          </Link>
          <p className="max-w-sm text-pretty text-sm leading-6">
            Governance intelligence for modern family wealth — a shared system of record for
            professional firms and the households they serve.
          </p>
          <SiteSocialLinks />
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:gap-x-10 lg:contents">
          <div className="space-y-2.5 sm:space-y-3">
            <p className="editorial-kicker">Platform</p>
            <nav className="flex flex-col gap-1.5 sm:gap-2" aria-label="Platform links">
              {SITE_AUDIENCE_NAV.map(({ id, label }) => (
                <Link key={id} href={audienceNavHref(id)} className={linkClassName}>
                  {label}
                </Link>
              ))}
              {SITE_PRIMARY_NAV_LINKS.map(({ href, label }) => (
                <Link key={href} href={href} className={linkClassName}>
                  {label}
                </Link>
              ))}
              <Link href="/start" className={linkClassName}>
                Start Assessment
              </Link>
              <Link href="/signin" className={linkClassName}>
                Sign In
              </Link>
            </nav>
          </div>

          <div className="space-y-2.5 sm:space-y-3">
            <p className="editorial-kicker">Company</p>
            <nav className="flex flex-col gap-1.5 sm:gap-2" aria-label="Company links">
              {SITE_SECONDARY_NAV_LINKS.map(({ href, label }) => (
                <Link key={href} href={href} className={linkClassName}>
                  {label}
                </Link>
              ))}
              <Link href="/privacy" className={linkClassName}>
                Privacy Policy
              </Link>
              <Link href="/terms" className={linkClassName}>
                Terms of Service
              </Link>
            </nav>
            <SiteBusinessContact />
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-2 border-t border-border/60 pt-5 text-left sm:mt-10 sm:gap-3 sm:pt-6 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
        <p className="text-xs leading-5 sm:text-sm">
          &copy; {year} {LEGAL_ENTITY_NAME}. All rights reserved.
        </p>
        <p className="max-w-md text-xs leading-5 lg:max-w-sm lg:text-right">
          Built for the professional-led process used by AKILI Risk Intelligence.
        </p>
      </div>
    </footer>
  );
}
