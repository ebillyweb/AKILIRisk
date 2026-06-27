import type { ReactNode } from "react";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { cn } from "@/lib/utils";

type PublicPageShellProps = {
  children: ReactNode;
  /** Content max width — full for homepage bands, wide for pricing/contact, narrow for legal */
  maxWidth?: "full" | "narrow" | "wide";
  className?: string;
  contentClassName?: string;
};

const MAX_WIDTH_CLASS = {
  full: "",
  narrow: "max-w-3xl",
  wide: "max-w-6xl",
} as const;

export function PublicPageShell({
  children,
  maxWidth = "wide",
  className,
  contentClassName,
}: PublicPageShellProps) {
  return (
    <>
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>
      <main
        id="main-content"
        className="min-h-screen pb-12 pt-2 sm:pb-16"
        tabIndex={-1}
      >
        <div className="page-shell flex flex-col gap-14 sm:gap-20 lg:gap-24">
          <SiteHeader />
          <div
            className={cn(
              "mx-auto w-full space-y-12 sm:space-y-14",
              MAX_WIDTH_CLASS[maxWidth],
              className,
              contentClassName,
            )}
          >
            {children}
          </div>
          <SiteFooter />
        </div>
      </main>
    </>
  );
}
