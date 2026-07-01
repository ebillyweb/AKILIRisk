import Link from "next/link";
import type { AdvisorPillarShortcut } from "@/lib/advisor/pillar-shortcuts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AdvisorPillarShortcutsProps = {
  shortcuts: AdvisorPillarShortcut[];
};

export function AdvisorPillarShortcuts({ shortcuts }: AdvisorPillarShortcutsProps) {
  return (
    <section
      aria-labelledby="advisor-pillar-shortcuts-heading"
      className="rounded-xl border border-border/80 bg-gradient-to-b from-primary/[0.04] to-transparent p-5 shadow-sm sm:p-6"
    >
      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="px-0 pt-0">
          <CardTitle id="advisor-pillar-shortcuts-heading" className="text-base">
            Assessment pillars
          </CardTitle>
          <CardDescription>
            Household risk domains for intake and scoring. Configure your methodology in{" "}
            <Link href="/advisor/methodology" className="font-medium text-primary underline-offset-4 hover:underline">
              Account → Methodology settings
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 px-0 pb-0 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.length === 0 ? (
            <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
              No pillars are active in your methodology. Enable pillars under Methodology → Pillar manager.
            </p>
          ) : (
            shortcuts.map(({ id, name, summary, icon: PillarIcon }) => {
              const href = `/advisor/methodology/questions/${encodeURIComponent(id)}`;
              return (
                <Link key={id} href={href} className="group">
                  <div className="h-full rounded-lg border border-border/70 bg-card p-5 transition-colors hover:border-primary/25 hover:bg-muted/40">
                    <div className="flex items-start gap-4">
                      <div className="rounded-md bg-primary/10 p-2 ring-1 ring-primary/10">
                        <PillarIcon className="h-5 w-5 text-primary" aria-hidden />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <h4 className="font-semibold leading-snug group-hover:text-primary">
                          {name}
                        </h4>
                        {summary ? (
                          <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </CardContent>
      </Card>
    </section>
  );
}
