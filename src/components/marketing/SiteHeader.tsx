"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AkiliLogoLockup } from "@/components/home/AkiliLogoLockup";
import { MarketingNavAuthActions } from "@/components/marketing/MarketingNavAuthActions";
import { MobileNavMenu } from "@/components/marketing/MobileNavMenu";
import { Button } from "@/components/ui/button";
import { SITE_NAV_LINKS } from "@/lib/marketing/site-nav";
import { cn } from "@/lib/utils";

type SiteHeaderProps = {
  className?: string;
  showLogo?: boolean;
};

export function SiteHeader({ className, showLogo = true }: SiteHeaderProps) {
  const pathname = usePathname();

  return (
    <header
      className={cn(
        "site-header sticky top-0 z-40 -mx-4 px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4 rounded-[1.25rem] border border-border/60 bg-card/75 px-4 py-3 shadow-[0_12px_40px_-28px_rgba(26,24,20,0.35)] backdrop-blur-xl sm:px-5">
        {showLogo ? (
          <Link href="/" className="shrink-0 text-foreground" aria-label="AKILI home">
            <AkiliLogoLockup className="h-auto w-full max-w-[168px] sm:max-w-[188px]" />
          </Link>
        ) : (
          <div aria-hidden className="w-px" />
        )}

        <nav
          className="hidden items-center gap-1 lg:flex"
          aria-label="Main navigation"
        >
          {SITE_NAV_LINKS.map(({ href, label }) => {
            const isActive = pathname === href;
            return (
              <Button
                key={href}
                asChild
                variant="ghost"
                size="sm"
                className={cn(
                  "h-9 px-3 text-sm",
                  isActive &&
                    "bg-secondary font-semibold text-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Link href={href} aria-current={isActive ? "page" : undefined}>
                  {label}
                </Link>
              </Button>
            );
          })}
          <div className="ml-2 flex items-center gap-2 border-l border-border/60 pl-3">
            <MarketingNavAuthActions />
          </div>
        </nav>

        <MobileNavMenu />
      </div>
    </header>
  );
}
