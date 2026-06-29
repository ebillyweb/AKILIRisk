"use client";

import { PanelLeft, PanelLeftClose, Shield, Zap } from "lucide-react";

import { AdminSidebarNav } from "@/components/admin/layout/AdminSidebarNav";
import { useAdminSidebarCollapsed } from "@/components/admin/layout/use-admin-sidebar-collapsed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface AdminSidebarProps {
  superUser: boolean;
  className?: string;
}

export function AdminSidebar({ superUser, className }: AdminSidebarProps) {
  const { collapsed, toggle } = useAdminSidebarCollapsed();
  const roleLabel = superUser ? "Super Admin" : "Standard Admin";

  return (
    <TooltipProvider delayDuration={300}>
      <aside
        data-collapsed={collapsed ? "true" : "false"}
        className={cn(
          "flex flex-col border-r border-border/60 bg-card transition-[width] duration-200 ease-in-out",
          collapsed ? "w-[4.5rem]" : "w-64",
          className,
        )}
      >
        <div
          className={cn(
            "flex shrink-0 pt-3",
            collapsed ? "justify-center px-2" : "px-4",
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            {collapsed ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
          </Button>
        </div>

        <div
          className={cn(
            "border-b border-border/60",
            collapsed ? "px-2 pb-3 pt-3" : "px-4 pb-5 pt-3",
          )}
        >
          <div
            className={cn(
              "flex gap-3",
              collapsed ? "flex-col items-center" : "items-start",
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary",
                    collapsed ? "size-9" : "size-10",
                  )}
                >
                  <Shield className={collapsed ? "size-4" : "size-5"} />
                </div>
              </TooltipTrigger>
              {collapsed ? (
                <TooltipContent side="right" className="max-w-56">
                  <p className="font-medium">AKILI Control</p>
                  <p className="text-xs text-muted-foreground">Administration</p>
                  <p className="mt-2 text-xs text-muted-foreground">{roleLabel}</p>
                </TooltipContent>
              ) : null}
            </Tooltip>

            {!collapsed ? (
              <div className="min-w-0 flex-1 overflow-hidden">
                <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">
                  AKILI Control
                </h2>
                <p className="text-xs text-muted-foreground">Administration</p>
                <Badge
                  variant={superUser ? "default" : "secondary"}
                  className="mt-3 text-xs"
                >
                  {roleLabel}
                </Badge>
              </div>
            ) : null}
          </div>
        </div>

        <AdminSidebarNav superUser={superUser} collapsed={collapsed} />

        <div
          className={cn(
            "mt-auto border-t border-border/60",
            collapsed ? "p-2" : "p-4",
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "flex items-center text-xs text-muted-foreground",
                  collapsed ? "justify-center" : "gap-2",
                )}
              >
                <Zap className="size-3 shrink-0" />
                {!collapsed ? <span>Platform Status: Operational</span> : null}
                {collapsed ? <span className="sr-only">Platform Status: Operational</span> : null}
              </div>
            </TooltipTrigger>
            {collapsed ? (
              <TooltipContent side="right">Platform Status: Operational</TooltipContent>
            ) : null}
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
