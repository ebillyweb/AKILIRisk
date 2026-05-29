"use client";

import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, ArrowRight, Radio, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SignalFeedItem as SignalFeedItemType } from "@/lib/signals/types";
import { markSignalReadAction } from "@/lib/actions/advisor-actions";
import { markNotificationReadAction } from "@/lib/actions/advisor-actions";
import { useRouter } from "next/navigation";

function severityVariant(severity: string): "warning" | "secondary" | "outline" {
  if (severity === "critical") return "warning";
  if (severity === "moderate") return "secondary";
  return "outline";
}

export function SignalFeedItemRow({ item }: { item: SignalFeedItemType }) {
  const router = useRouter();
  const unread = !item.read;
  const href = item.kind === "risk" ? item.payload.href : item.href;
  const clientLabel = item.kind === "risk" ? item.clientName : null;

  async function handleActivate() {
    if (item.kind === "risk") {
      if (!item.read) {
        await markSignalReadAction(item.id);
      }
    } else if (!item.read) {
      await markNotificationReadAction(item.id);
    }
    router.push(href);
    router.refresh();
  }

  const Icon = item.severity === "critical" ? AlertTriangle : item.kind === "workflow" ? Workflow : Radio;

  return (
    <button
      type="button"
      onClick={() => void handleActivate()}
      className={cn(
        "group relative flex w-full gap-4 rounded-xl border p-4 text-left transition-[background-color,box-shadow,border-color] duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        unread
          ? "border-primary/30 bg-primary/[0.06] shadow-sm hover:bg-primary/[0.09]"
          : "border-border/70 bg-card hover:border-border hover:bg-muted/35"
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
          item.severity === "critical"
            ? "border-destructive/30 bg-destructive/10 text-destructive"
            : "border-border/60 bg-muted/50 text-muted-foreground"
        )}
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={severityVariant(item.severity)} className="h-5 text-[10px] uppercase tracking-wide">
            {item.severity}
          </Badge>
          <Badge variant="outline" className="h-5 text-[10px]">
            {item.kind === "workflow" ? "Workflow" : "Risk"}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(item.createdAt, { addSuffix: true })}
          </span>
        </div>
        <p className="font-medium text-foreground leading-snug">{item.title}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {clientLabel ? (
            <>
              <span className="font-medium text-foreground/90">{clientLabel}</span>
              <span className="mx-1 text-muted-foreground/60">·</span>
            </>
          ) : null}
          {item.message}
        </p>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          Open
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
      {unread ? (
        <span
          className="absolute right-4 top-4 h-2 w-2 rounded-full bg-primary"
          aria-label="Unread"
        />
      ) : null}
    </button>
  );
}
