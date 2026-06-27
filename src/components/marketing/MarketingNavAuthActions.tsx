"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MarketingNavAuthActionsProps = {
  layout?: "inline" | "stacked";
};

export function MarketingNavAuthActions({
  layout = "inline",
}: MarketingNavAuthActionsProps) {
  const { status } = useSession();
  const stacked = layout === "stacked";

  if (status === "loading") {
    return (
      <div
        className={cn(
          "h-9 w-28 animate-pulse rounded-lg bg-muted/70",
          stacked && "w-full",
        )}
        aria-hidden
      />
    );
  }

  if (status === "authenticated") {
    return (
      <div className={cn("flex gap-2", stacked && "flex-col")}>
        <Button size={stacked ? "lg" : "sm"} asChild className={stacked ? "w-full" : undefined}>
          <Link href="/dashboard">
            Go to Dashboard
            <ArrowRight className="ml-1 size-4" aria-hidden />
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          size={stacked ? "lg" : "sm"}
          className={stacked ? "w-full" : undefined}
          onClick={() => void signOut({ redirectTo: "/" })}
        >
          Sign Out
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-2", stacked && "flex-col")}>
      <Button
        variant="outline"
        size={stacked ? "lg" : "sm"}
        asChild
        className={stacked ? "w-full" : undefined}
      >
        <Link href="/signin">Sign In</Link>
      </Button>
      <Button size={stacked ? "lg" : "sm"} asChild className={stacked ? "w-full" : undefined}>
        <Link href="/start">
          Get Started
          <ArrowRight className="ml-1 size-4" aria-hidden />
        </Link>
      </Button>
    </div>
  );
}
