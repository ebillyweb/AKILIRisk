import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ActivityType = "assessment" | "advisor" | "intake" | "integration" | "report" | "system";

interface RecentActivityItemProps {
  type: ActivityType;
  icon: LucideIcon;
  title: string;
  description: string;
  timestamp: string;
  user?: string | null;
  className?: string;
}

const typeStyles: Record<ActivityType, string> = {
  assessment: "text-blue-600 bg-blue-50 border-blue-200",
  advisor: "text-purple-600 bg-purple-50 border-purple-200",
  intake: "text-green-600 bg-green-50 border-green-200",
  integration: "text-orange-600 bg-orange-50 border-orange-200",
  report: "text-indigo-600 bg-indigo-50 border-indigo-200",
  system: "text-gray-600 bg-gray-50 border-gray-200",
};

export function RecentActivityItem({
  type,
  icon: Icon,
  title,
  description,
  timestamp,
  user,
  className,
}: RecentActivityItemProps) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      {/* Activity Type Icon */}
      <div className={cn("rounded-lg p-2 border shrink-0 mt-0.5", typeStyles[type])}>
        <Icon className="size-3" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-medium text-foreground truncate">
            {title}
          </h4>
          <time className="text-xs text-muted-foreground/80 shrink-0">
            {timestamp}
          </time>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>

        {user && (
          <p className="text-xs text-muted-foreground/80">
            by {user}
          </p>
        )}
        {!user && (
          <p className="text-xs text-muted-foreground/80">
            by system
          </p>
        )}
      </div>
    </div>
  );
}