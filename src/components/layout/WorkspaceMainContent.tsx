import { ReactNode } from "react";
import { SiteFooter } from "@/components/marketing/SiteFooter";

interface WorkspaceMainPaddingProps {
  children: ReactNode;
}

export function WorkspaceMainPadding({ children }: WorkspaceMainPaddingProps) {
  return <div className="p-4 sm:p-6 lg:p-8">{children}</div>;
}

/** Full-width footer row below sidebar + main (advisor / admin workspaces). */
export function WorkspaceSiteFooterRow() {
  return (
    <div className="w-full shrink-0 border-t border-border/70 bg-background px-4 py-6 sm:px-6 lg:px-8">
      <SiteFooter className="border-t-0 pt-0" />
    </div>
  );
}
