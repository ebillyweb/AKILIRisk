import type { ReactNode } from "react";
import { DocsMobileNav } from "@/components/docs/DocsMobileNav";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { PublicPageShell } from "@/components/marketing/PublicPageShell";

type DocsShellProps = {
  children: ReactNode;
};

export function DocsShell({ children }: DocsShellProps) {
  return (
    <PublicPageShell maxWidth="full" contentClassName="!space-y-8 sm:!space-y-10">
      <div className="mx-auto w-full max-w-6xl">
        <DocsMobileNav />

        <div className="mt-6 grid gap-10 lg:mt-0 lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[16.5rem_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-28 max-h-[calc(100dvh-8rem)] overflow-y-auto pr-2">
              <DocsSidebar />
            </div>
          </aside>

          <div className="min-w-0 rounded-[1.75rem] border border-border/60 bg-card/40 px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
            {children}
          </div>
        </div>
      </div>
    </PublicPageShell>
  );
}
