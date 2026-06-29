import { ReactNode } from "react";
import {
  WorkspaceMainPadding,
  WorkspaceSiteFooterRow,
} from "@/components/layout/WorkspaceMainContent";
import { AdminPageHeaderFromPath } from "@/components/layout/AdminPageHeader";
import { AdminSidebar } from "./AdminSidebar";
import { AdminMobileNav } from "./AdminMobileNav";
import { cn } from "@/lib/utils";

interface AdminControlCenterLayoutProps {
  children: ReactNode;
  superUser: boolean;
  className?: string;
}

export function AdminControlCenterLayout({
  children,
  superUser,
  className,
}: AdminControlCenterLayoutProps) {
  return (
    <div
      className={cn(
        "flex min-h-[calc(100vh-8rem)] flex-col bg-background",
        className
      )}
    >
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <AdminSidebar superUser={superUser} className="hidden shrink-0 lg:flex" />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <AdminMobileNav superUser={superUser} />

          <main className="min-h-0 flex-1 overflow-y-auto">
            <WorkspaceMainPadding>
              <div className="mb-6 sm:mb-8">
                <AdminPageHeaderFromPath />
              </div>
              {children}
            </WorkspaceMainPadding>
          </main>
        </div>
      </div>

      <WorkspaceSiteFooterRow />
    </div>
  );
}
