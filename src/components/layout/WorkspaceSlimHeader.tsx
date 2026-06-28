import Link from "next/link";
import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { AkiliHeaderLockup } from "@/components/home/AkiliLogoLockup";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

interface WorkspaceSlimHeaderProps {
  homeHref: string;
  homeAriaLabel: string;
  userEmail?: string;
}

export function WorkspaceSlimHeader({
  homeHref,
  homeAriaLabel,
  userEmail,
}: WorkspaceSlimHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Link
        href={homeHref}
        className="inline-flex shrink-0 leading-none text-foreground transition-opacity duration-200 hover:opacity-80"
        aria-label={homeAriaLabel}
      >
        <AkiliHeaderLockup height={40} />
      </Link>
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {userEmail ? (
          <p className="hidden max-w-[min(100%,14rem)] truncate text-xs text-muted-foreground sm:block">
            {userEmail}
          </p>
        ) : null}
        <ThemeToggle className="shrink-0" />
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <Button type="submit" variant="outline" size="sm" className="min-w-[96px]">
            Sign Out
          </Button>
        </form>
      </div>
    </div>
  );
}
