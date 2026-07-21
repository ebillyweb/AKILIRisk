import { Skeleton } from "@/components/ui/skeleton";

export default function FamilyDashboardLoading() {
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero section skeleton */}
      <section className="hero-surface rounded-[1.75rem] p-4 sm:p-8">
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div className="space-y-2 sm:space-y-3">
            {/* Editorial kicker skeleton */}
            <Skeleton className="h-4 w-24" />
            {/* Heading skeleton */}
            <div className="space-y-2">
              <Skeleton className="h-8 w-80 max-w-full" />
              <Skeleton className="h-8 w-64 max-w-full" />
            </div>
            {/* Description skeleton */}
            <div className="space-y-2 pt-2">
              <Skeleton className="h-4 w-full max-w-2xl" />
              <Skeleton className="h-4 w-96 max-w-full" />
            </div>
          </div>

          {/* Household members card skeleton */}
          <div className="bg-background/60 rounded-lg border p-4">
            <Skeleton className="h-4 w-32 mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <div className="flex gap-1">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Score card skeleton */}
      <div className="bg-card rounded-lg border">
        <div className="p-6 border-b">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="p-6 space-y-6">
          {/* Overall score skeleton */}
          <div className="text-center space-y-3">
            <Skeleton className="h-16 w-32 mx-auto" />
            <Skeleton className="h-6 w-24 rounded-full mx-auto" />
          </div>

          {/* Categories skeleton */}
          <div className="space-y-4">
            <Skeleton className="h-6 w-40" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <Skeleton className="h-5 w-28" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-2 w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Chart skeleton */}
      <div className="bg-card rounded-lg border">
        <div className="p-6 border-b">
          <Skeleton className="h-6 w-44 mb-2" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="p-6">
          <Skeleton className="h-[300px] w-full" />
        </div>
      </div>
    </div>
  );
}
