export default function PipelineLoading() {
  return (
    <div className="space-y-6">
      {/* Metrics skeleton */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-md bg-muted/50 px-3 py-2">
            <div className="space-y-2">
              <div className="h-6 w-8 bg-muted rounded animate-pulse" />
              <div className="h-3 w-16 bg-muted rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar skeleton */}
      <div className="space-y-4 rounded-lg border border-border/70 bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="h-10 flex-1 rounded-md bg-muted animate-pulse" />
          <div className="flex gap-2">
            <div className="h-10 w-36 rounded-md bg-muted animate-pulse" />
            <div className="h-10 w-44 rounded-md bg-muted animate-pulse" />
          </div>
        </div>
        <div className="space-y-2 border-t border-border/50 pt-4">
          <div className="h-3 w-24 rounded bg-muted animate-pulse" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      </div>

      {/* Table skeleton */}
      <div className="rounded-md border">
        {/* Table header */}
        <div className="grid grid-cols-6 gap-4 p-4 border-b">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-4 bg-muted rounded animate-pulse" />
          ))}
        </div>
        {/* Table rows */}
        {[...Array(6)].map((_, i) => (
          <div key={i} className="grid grid-cols-6 gap-4 p-4 border-b last:border-b-0">
            {[...Array(6)].map((_, j) => (
              <div key={j} className="h-6 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}