"use client";

import Link from "next/link";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const navLinkBase =
  "relative inline-flex h-10 items-center overflow-visible rounded-lg px-3 text-[13px] font-medium tracking-[-0.01em] text-muted-foreground transition-[color,background-color] duration-200 ease-out hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Real element — more reliable than ::after across Safari/Chrome. */
export function NavActiveIndicator({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-3 bottom-1.5 h-px rounded-full bg-foreground/75",
        className,
      )}
    />
  );
}

export const navLinkActiveClassName = "text-foreground";

type MarketingNavLinkProps = {
  href: string;
  children: React.ReactNode;
  isActive?: boolean;
  className?: string;
  onClick?: () => void;
  "data-testid"?: string;
  "aria-current"?: "page" | undefined;
};

export const MarketingNavLink = forwardRef<
  HTMLAnchorElement | HTMLButtonElement,
  MarketingNavLinkProps
>(function MarketingNavLink(
  { href, children, isActive, className, onClick, ...rest },
  ref,
) {
  const classes = cn(navLinkBase, isActive && navLinkActiveClassName, className);

  if (onClick) {
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        onClick={onClick}
        className={classes}
        aria-current={rest["aria-current"]}
        data-testid={rest["data-testid"]}
      >
        {children}
        {isActive ? <NavActiveIndicator /> : null}
      </button>
    );
  }

  return (
    <Link
      ref={ref as React.Ref<HTMLAnchorElement>}
      href={href}
      className={classes}
      aria-current={rest["aria-current"]}
      data-testid={rest["data-testid"]}
    >
      {children}
      {isActive ? <NavActiveIndicator /> : null}
    </Link>
  );
});

export const marketingNavLinkClassName = navLinkBase;
