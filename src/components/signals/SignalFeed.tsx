import type { SignalFeedItem } from "@/lib/signals/types";
import { SignalFeedItemRow } from "@/components/signals/SignalFeedItem";

export function SignalFeed({ items }: { items: SignalFeedItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-12 text-center">
        <p className="text-sm font-medium text-foreground">No signals in the last 90 days</p>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
          Assessment changes and workflow activity will appear here. Current portfolio risk state
          lives under Risk intelligence.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3" role="list">
      {items.map((item) => (
        <li key={`${item.kind}-${item.id}`}>
          <SignalFeedItemRow item={item} />
        </li>
      ))}
    </ul>
  );
}
