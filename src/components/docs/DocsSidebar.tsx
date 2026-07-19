"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOCS_NAV, docsHref } from "@/lib/docs";
import { cn } from "@/lib/utils";

type DocsSidebarProps = {
  className?: string;
  onNavigate?: () => void;
};

export function DocsSidebar({ className, onNavigate }: DocsSidebarProps) {
  const pathname = usePathname();

  return (
    <nav className={cn("space-y-7", className)} aria-label="Documentation">
      {DOCS_NAV.map((group) => (
        <div key={group.id} className="space-y-2">
          <p className="editorial-kicker !text-[0.625rem] !tracking-[0.14em]">
            {group.title}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const href = docsHref(item.slug);
              const isActive =
                item.slug === ""
                  ? pathname === "/docs"
                  : pathname === href || pathname.startsWith(`${href}/`);

              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "block rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      isActive
                        ? "bg-muted/70 text-foreground"
                        : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                    )}
                  >
                    {item.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
