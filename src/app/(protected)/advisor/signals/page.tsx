import Link from "next/link";
import { FileText, Radio, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAdvisorSignalsAction, markAllSignalsReadAction } from "@/lib/actions/advisor-actions";
import { SignalFeed } from "@/components/signals/SignalFeed";
import { SignalSummaryStrip } from "@/components/signals/SignalSummaryStrip";
import { redirect } from "next/navigation";

async function MarkAllReadButton({ hasUnread }: { hasUnread: boolean }) {
  async function markAllRead() {
    "use server";
    await markAllSignalsReadAction();
  }

  if (!hasUnread) return null;

  return (
    <form action={markAllRead}>
      <Button type="submit" variant="outline" size="sm" className="min-h-9 shrink-0">
        Mark all as read
      </Button>
    </form>
  );
}

export default async function AdvisorSignalsPage() {
  const result = await getAdvisorSignalsAction();

  if (!result.success) {
    redirect("/advisor");
  }

  const { items, summary } = result.data!;

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm ring-1 ring-border/30 sm:p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:items-center">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/60"
              aria-hidden
            >
              <Radio className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Signals</h1>
              <p className="text-sm text-muted-foreground max-w-xl">
                What changed across your portfolio — assessment risk events and workflow activity.
                Showing critical and moderate items from the last 90 days.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button variant="outline" size="sm" asChild className="min-h-9">
              <Link href="/advisor/reports" className="inline-flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                Reports
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="min-h-9">
              <Link href="/advisor/intelligence" className="inline-flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 shrink-0" />
                Risk intelligence
              </Link>
            </Button>
            <MarkAllReadButton hasUnread={summary.unreadCount > 0} />
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-border/50">
          <SignalSummaryStrip summary={summary} />
        </div>
      </div>

      <SignalFeed items={items} />
    </div>
  );
}
