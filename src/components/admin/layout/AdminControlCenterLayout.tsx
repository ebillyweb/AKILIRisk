import { ReactNode } from "react";
import { AdminSidebar } from "./AdminSidebar";
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
      {/* Sidebar */}
      <AdminSidebar superUser={superUser} className="w-64 shrink-0 hidden lg:flex" />

      {/* Mobile Sidebar Toggle - TODO: Add mobile sidebar implementation */}
      <div className="lg:hidden">
        {/* Mobile sidebar implementation would go here */}
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="p-6 lg:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}