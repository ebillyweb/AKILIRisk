import Link from "next/link";
import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { AkiliLogoLockup } from "@/components/home/AkiliLogoLockup";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

interface WorkspaceSlimHeaderProps {
  homeHref: string;
  homeAriaLabel: string;
}

export function WorkspaceSlimHeader({ homeHref, homeAriaLabel }: WorkspaceSlimHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Link
        href={homeHref}
        className="block shrink-0 text-foreground"
        aria-label={homeAriaLabel}
      >
        <AkiliLogoLockup className="h-auto w-full max-w-[140px] sm:max-w-[160px]" />
      </Link>
      <div className="flex items-center gap-2 sm:gap-3">
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
