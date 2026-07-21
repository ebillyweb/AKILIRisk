import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors {@link ClientDashboardOverview}: a hero (headline + "Your journey"
 * tracker) and the footer strip. The "Explore your portal" destination grid is
 * intentionally omitted — it is hidden on advisor-branded portals, so rendering
 * it here would flash cards that vanish once real content loads.
 */
export default function ClientDashboardLoading() {
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero */}
      <section className="hero-surface rounded-[1.75rem] p-4 sm:p-8">
        <div className="space-y-5">
          {/* Headline + subheadline */}
          <div className="space-y-2">
            <Skeleton className="h-8 w-72 max-w-full sm:h-9" />
            <Skeleton className="h-5 w-full max-w-3xl" />
          </div>

          {/* "Your journey" tracker */}
          <div className="space-y-3">
            <Skeleton className="h-3 w-24" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-xl border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-6 shrink-0 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="mt-3 h-3 w-full" />
                  <Skeleton className="mt-1.5 h-3 w-3/4" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer strip */}
      <section className="rounded-[1.25rem] border section-divider bg-muted/20 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Skeleton className="mt-0.5 size-5 shrink-0 rounded" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-full max-w-xl" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
          </div>
          <Skeleton className="h-8 w-40 shrink-0" />
        </div>
      </section>
    </div>
  );
}
