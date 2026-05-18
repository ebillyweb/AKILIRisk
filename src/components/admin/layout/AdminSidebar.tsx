import { Shield, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { AdminSidebarNav } from "./AdminSidebarNav";

interface AdminSidebarProps {
  superUser: boolean;
  className?: string;
}

export function AdminSidebar({ superUser, className }: AdminSidebarProps) {
  return (
    <aside
      className={cn("flex flex-col bg-card border-r border-border/60", className)}
    >
      <div className="p-6 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Shield className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              AKILI Control
            </h2>
            <p className="text-xs text-muted-foreground">Administration</p>
          </div>
        </div>
        {!superUser && (
          <Badge variant="secondary" className="mt-3 text-xs">
            Standard Admin
          </Badge>
        )}
        {superUser && (
          <Badge variant="default" className="mt-3 text-xs">
            Super Admin
          </Badge>
        )}
      </div>

      <AdminSidebarNav superUser={superUser} />

      <div className="p-4 border-t border-border/60">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Zap className="size-3" />
          <span>Platform Status: Operational</span>
        </div>
      </div>
    </aside>
  );
}
