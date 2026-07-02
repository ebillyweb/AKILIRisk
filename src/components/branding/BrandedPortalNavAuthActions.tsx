"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { scopePathToCurrentTenant } from "@/lib/client/tenant-path-prefix-client";
import { cn } from "@/lib/utils";

type BrandedPortalNavAuthActionsProps = {
  layout?: "inline" | "stacked";
  className?: string;
};

/**
 * Tenant portal header CTAs — always the public Sign In / Start Assessment pair.
 * Unlike {@link MarketingNavAuthActions}, does not switch to a logged-in dashboard
 * nav so advisors previewing their white-label portal while signed in still see
 * the client-facing header (including on sign-in tab changes).
 */
export function BrandedPortalNavAuthActions({
  layout = "inline",
  className,
}: BrandedPortalNavAuthActionsProps) {
  const pathname = usePathname();
  const stacked = layout === "stacked";
  const signInHref = scopePathToCurrentTenant("/signin?role=client", pathname);
  const startHref = scopePathToCurrentTenant("/start", pathname);

  return (
    <div className={cn("flex items-center gap-3", stacked && "flex-col", className)}>
      <Link
        href={signInHref}
        className={cn(
          "inline-flex h-10 items-center rounded-lg px-3 text-[13px] font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          stacked && "h-12 w-full justify-center text-base",
        )}
      >
        Sign In
      </Link>
      <Button
        size={stacked ? "lg" : "default"}
        asChild
        className={cn(
          stacked
            ? "h-12 w-full text-base"
            : "h-9 rounded-lg px-4 text-[13px] font-semibold shadow-none",
        )}
      >
        <Link href={startHref}>
          Start Assessment
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </Button>
    </div>
  );
}
