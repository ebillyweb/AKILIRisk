"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { MarketingNavAuthActions } from "@/components/marketing/MarketingNavAuthActions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BrandedPortalNavLink = {
  href: string;
  label: string;
};

const DEFAULT_NAV_LINKS: BrandedPortalNavLink[] = [];

type BrandedPortalMobileNavProps = {
  navLinks?: BrandedPortalNavLink[];
  primaryHex?: string;
};

export function BrandedPortalMobileNav({
  navLinks = DEFAULT_NAV_LINKS,
  primaryHex,
}: BrandedPortalMobileNavProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-10 shrink-0"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
        style={
          primaryHex
            ? {
                borderColor: `${primaryHex}33`,
              }
            : undefined
        }
      >
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <nav
            id={panelId}
            className="marketing-card absolute inset-x-4 top-4 rounded-[1.25rem] border border-border/70 bg-card/95 p-4 shadow-[0_24px_60px_-32px_rgba(26,24,20,0.35)] backdrop-blur-xl"
            aria-label="Portal navigation"
          >
            <div className="space-y-1">
              {navLinks.map(({ href, label }) => {
                const isActive = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center rounded-xl px-4 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
            <div
              className={cn(
                "flex flex-col gap-2",
                navLinks.length > 0 && "mt-4 border-t border-border/60 pt-4",
              )}
            >
              <MarketingNavAuthActions layout="stacked" />
            </div>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
