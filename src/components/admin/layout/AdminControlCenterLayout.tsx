import { ReactNode } from "react";
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
    <div className={cn("flex min-h-[calc(100vh-12rem)] bg-background", className)}>
      <AdminSidebar superUser={superUser} className="hidden w-64 shrink-0 lg:flex" />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AdminMobileNav superUser={superUser} />

        <main className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto">
            <div className="p-4 sm:p-6 lg:p-8">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
