"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import type { HeroAudience } from "@/components/home/hero/hero-audience-content";
import { MarketingNavAuthActions } from "@/components/marketing/MarketingNavAuthActions";
import {
  audienceNavHref,
  SITE_AUDIENCE_NAV,
  SITE_PRIMARY_NAV_LINKS,
  SITE_SECONDARY_NAV_LINKS,
} from "@/lib/marketing/site-nav";
import { cn } from "@/lib/utils";

type MobileNavMenuProps = {
  className?: string;
  isHomepage?: boolean;
  activeAudience?: HeroAudience;
  onAudienceChange?: (audience: HeroAudience) => void;
};

export function MobileNavMenu({
  className,
  isHomepage = false,
  activeAudience,
  onAudienceChange,
}: MobileNavMenuProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    firstLinkRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    menuButtonRef.current?.focus();
  };

  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div className={cn("relative", className)}>
      <button
        ref={menuButtonRef}
        type="button"
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-lg px-3 text-[13px] font-medium text-foreground transition-colors duration-200",
          "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="relative flex h-4 w-4 flex-col justify-center gap-[3px]" aria-hidden>
          <span
            className={cn(
              "block h-px w-4 origin-center bg-foreground transition-all duration-200",
              open && "translate-y-[4px] rotate-45",
            )}
          />
          <span
            className={cn(
              "block h-px w-4 bg-foreground transition-all duration-200",
              open && "opacity-0",
            )}
          />
          <span
            className={cn(
              "block h-px w-4 origin-center bg-foreground transition-all duration-200",
              open && "-translate-y-[4px] -rotate-45",
            )}
          />
        </span>
        <span>{open ? "Close" : "Menu"}</span>
      </button>

      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={transition}
              className="fixed inset-0 z-50 bg-background/72 backdrop-blur-md"
              aria-label="Close navigation menu"
              onClick={close}
            />
            <motion.nav
              id={panelId}
              initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
              transition={transition}
              className={cn(
                "fixed inset-x-3 top-[5.25rem] z-50 flex max-h-[calc(100dvh-6rem)] flex-col overflow-y-auto",
                "rounded-2xl border border-border/40 bg-background/95 p-6 shadow-[0_24px_64px_-32px_rgba(26,24,20,0.35)] backdrop-blur-2xl",
              )}
              aria-label="Mobile navigation"
            >
              <div className="space-y-8">
                <div className="space-y-3">
                  <p className="editorial-kicker !text-[0.625rem] !tracking-[0.14em]">
                    Choose your path
                  </p>
                  <div className="flex flex-col gap-1">
                    {SITE_AUDIENCE_NAV.map(({ id, label, testId }, index) => {
                      const isActive = isHomepage && activeAudience === id;

                      if (isHomepage && onAudienceChange) {
                        return (
                          <button
                            key={id}
                            type="button"
                            data-testid={testId}
                            onClick={() => {
                              onAudienceChange(id);
                              close();
                            }}
                            className={cn(
                              "flex min-h-12 items-center rounded-xl px-3 text-left text-lg font-medium tracking-tight transition-colors duration-200",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                              isActive
                                ? "bg-muted/60 text-foreground"
                                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                            )}
                          >
                            {label}
                          </button>
                        );
                      }

                      return (
                        <Link
                          key={id}
                          ref={index === 0 ? firstLinkRef : undefined}
                          href={audienceNavHref(id)}
                          data-testid={testId}
                          onClick={close}
                          className={cn(
                            "flex min-h-12 items-center rounded-xl px-3 text-lg font-medium tracking-tight transition-colors duration-200",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                            "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                          )}
                        >
                          {label}
                        </Link>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="editorial-kicker !text-[0.625rem] !tracking-[0.14em]">
                    Platform
                  </p>
                  <div className="flex flex-col gap-1">
                    {SITE_PRIMARY_NAV_LINKS.map(({ href, label }) => {
                      const isActive =
                        href === "/docs"
                          ? pathname === "/docs" || pathname.startsWith("/docs/")
                          : pathname === href;
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={close}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "flex min-h-12 items-center rounded-xl px-3 text-lg font-medium tracking-tight transition-colors duration-200",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                            isActive
                              ? "bg-muted/60 text-foreground"
                              : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                          )}
                        >
                          {label}
                        </Link>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="editorial-kicker !text-[0.625rem] !tracking-[0.14em]">
                    Contact
                  </p>
                  <div className="flex flex-col gap-1">
                    {SITE_SECONDARY_NAV_LINKS.map(({ href, label }) => {
                      const isActive = pathname === href;
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={close}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "flex min-h-12 items-center rounded-xl px-3 text-base font-medium transition-colors duration-200",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                            isActive
                              ? "bg-muted/60 text-foreground"
                              : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                          )}
                        >
                          {label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-8 border-t border-border/50 pt-6">
                <MarketingNavAuthActions layout="stacked" />
              </div>
            </motion.nav>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
