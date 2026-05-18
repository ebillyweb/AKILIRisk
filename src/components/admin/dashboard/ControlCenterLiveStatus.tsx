"use client";

import { formatDistanceToNow } from "date-fns";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ControlCenterPollStatus } from "./use-control-center-polling";

interface ControlCenterLiveStatusProps {
  generatedAt: string;
  status: ControlCenterPollStatus;
  lastError: string | null;
  pollMs: number;
  onRefresh: () => void;
}

export function ControlCenterLiveStatus({
  generatedAt,
  status,
  lastError,
  pollMs,
  onRefresh,
}: ControlCenterLiveStatusProps) {
  const updatedLabel = (() => {
    const date = new Date(generatedAt);
    if (Number.isNaN(date.getTime())) return "—";
    return formatDistanceToNow(date, { addSuffix: true });
  })();

  const pollSeconds = Math.round(pollMs / 1000);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className={cn(
              "relative flex size-2 shrink-0 rounded-full",
              status === "error" ? "bg-destructive" : "bg-emerald-500"
            )}
            aria-hidden
          >
            {status === "refreshing" && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            )}
          </span>
          <span>
            {status === "error" ? "Update failed" : "Live"}
            {" · "}
            Updated {updatedLabel}
            {status !== "error" && ` · every ${pollSeconds}s`}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={() => void onRefresh()}
          disabled={status === "refreshing"}
        >
          <RefreshCw
            className={cn("size-3.5", status === "refreshing" && "animate-spin")}
          />
          Refresh
        </Button>
      </div>
      {status === "error" && lastError && (
        <div className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">
          <strong>Error:</strong> {lastError}
        </div>
      )}
    </div>
  );
}
