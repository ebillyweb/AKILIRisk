import Link from "next/link";
import { LEGAL_ENTITY_NAME } from "@/lib/legal/documents";
import { cn } from "@/lib/utils";

interface SiteFooterProps {
  className?: string;
}

export function SiteFooter({ className }: SiteFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      className={cn(
        "border-t border-border/70 pt-8 text-sm text-muted-foreground",
        className
      )}
    >
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
        <p>
          &copy; {year} {LEGAL_ENTITY_NAME}. All rights reserved.
        </p>
        <nav
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-end"
          aria-label="Footer"
        >
          <Link
            href="/about"
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            About Us
          </Link>
          <Link
            href="/contact"
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            Contact Us
          </Link>
          <Link
            href="/privacy"
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            Terms of Service
          </Link>
        </nav>
      </div>
    </footer>
  );
}
