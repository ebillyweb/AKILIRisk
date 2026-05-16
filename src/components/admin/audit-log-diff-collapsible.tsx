"use client";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export function AuditLogDiffCollapsible({
  summary,
  beforeData,
  afterData,
  metadata,
  ipAddress,
  userAgent,
}: {
  summary: string;
  beforeData: unknown;
  afterData: unknown;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
}) {
  return (
    <Collapsible>
      <CollapsibleTrigger
        className={cn(
          "w-full cursor-pointer rounded-md px-1 py-0.5 text-left text-xs outline-none",
          "hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-brand/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        )}
      >
        {summary}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 grid gap-2 lg:grid-cols-2">
          <div>
            <div className="text-xs font-semibold text-muted-foreground">before</div>
            <pre className="mt-1 max-h-64 overflow-auto rounded-xl border border-border/80 bg-muted/40 p-2 text-xs">
              {beforeData === null ? "null" : JSON.stringify(beforeData, null, 2)}
            </pre>
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground">after</div>
            <pre className="mt-1 max-h-64 overflow-auto rounded-xl border border-border/80 bg-muted/40 p-2 text-xs">
              {afterData === null ? "null" : JSON.stringify(afterData, null, 2)}
            </pre>
          </div>
          {metadata !== null ? (
            <div className="lg:col-span-2">
              <div className="text-xs font-semibold text-muted-foreground">metadata</div>
              <pre className="mt-1 max-h-32 overflow-auto rounded-xl border border-border/80 bg-muted/40 p-2 text-xs">
                {JSON.stringify(metadata, null, 2)}
              </pre>
            </div>
          ) : null}
          {ipAddress || userAgent ? (
            <div className="lg:col-span-2 text-xs text-muted-foreground">
              {ipAddress ? <span>IP: {ipAddress}</span> : null}
              {ipAddress && userAgent ? " · " : null}
              {userAgent ? <span>UA: {userAgent}</span> : null}
            </div>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
