"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MarketingNavAuthActionsProps = {
  layout?: "inline" | "stacked";
  className?: string;
};

export function MarketingNavAuthActions({
  layout = "inline",
  className,
}: MarketingNavAuthActionsProps) {
  const { status } = useSession();
  const router = useRouter();
  const stacked = layout === "stacked";

  async function handleSignOut() {
    await signOut({ redirect: false });
    router.refresh();
  }

  if (status === "loading") {
    return (
      <div
        className={cn(
          "h-9 w-28 animate-pulse rounded-lg bg-muted/50",
          stacked && "w-full",
          className,
        )}
        aria-hidden
      />
    );
  }

  if (status === "authenticated") {
    return (
      <div className={cn("flex gap-2", stacked && "flex-col", className)}>
        <Button
          size={stacked ? "lg" : "default"}
          asChild
          className={cn(
            stacked ? "h-12 w-full" : "h-9 rounded-lg px-4 text-[13px] font-medium",
          )}
        >
          <Link href="/dashboard">
            Go to Dashboard
            <ArrowRight className="size-3.5 opacity-80" aria-hidden />
          </Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size={stacked ? "lg" : "default"}
          className={cn(
            stacked ? "h-12 w-full" : "h-9 px-3 text-[13px] font-medium text-muted-foreground",
          )}
          onClick={() => void handleSignOut()}
        >
          Sign Out
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3", stacked && "flex-col", className)}>
      <Link
        href="/signin"
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
        <Link href="/start">
          Start Assessment
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </Button>
    </div>
  );
}
