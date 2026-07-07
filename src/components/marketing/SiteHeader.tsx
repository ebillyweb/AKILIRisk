"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AkiliHeaderLockup } from "@/components/home/AkiliLogoLockup";
import { useOptionalHeroAudience } from "@/components/home/hero/HeroAudienceContext";
import type { HeroAudience } from "@/components/home/hero/hero-audience-content";
import { SiteHeaderNav } from "@/components/marketing/nav/SiteHeaderNav";
import { MarketingNavAuthActions } from "@/components/marketing/MarketingNavAuthActions";
import { MobileNavMenu } from "@/components/marketing/MobileNavMenu";
import { isMarketingHomePath } from "@/lib/marketing/friendly-urls";
import { cn } from "@/lib/utils";

type SiteHeaderProps = {
  className?: string;
  showLogo?: boolean;
};

export function SiteHeader({ className, showLogo = true }: SiteHeaderProps) {
  const pathname = usePathname();
  const isHomepage = isMarketingHomePath(pathname);
  const heroAudience = useOptionalHeroAudience();

  return (
    <header
      className={cn(
        "site-header sticky top-0 z-40 -mx-4 px-4 pt-2 pb-1 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-4 rounded-2xl border border-border/35 py-2.5",
          "bg-background/55 px-4 shadow-[0_8px_32px_-24px_rgba(26,24,20,0.28)] backdrop-blur-2xl backdrop-saturate-150",
          "sm:gap-6 sm:px-5 lg:px-6",
        )}
      >
        {showLogo ? (
          <Link
            href="/"
            className="inline-flex shrink-0 leading-none text-foreground transition-opacity duration-200 hover:opacity-80"
            aria-label="AKILI home"
          >
            <AkiliHeaderLockup height={40} />
          </Link>
        ) : (
          <div aria-hidden className="w-px" />
        )}

        <SiteHeaderNav
          pathname={pathname}
          isHomepage={isHomepage}
          activeAudience={heroAudience?.audience}
          onAudienceChange={heroAudience?.setAudience}
        />

        <div className="hidden shrink-0 items-center gap-3 lg:flex">
          <MarketingNavAuthActions />
        </div>

        <MobileNavMenu
          className="lg:hidden"
          isHomepage={isHomepage}
          activeAudience={heroAudience?.audience satisfies HeroAudience | undefined}
          onAudienceChange={heroAudience?.setAudience}
        />
      </div>
    </header>
  );
}
